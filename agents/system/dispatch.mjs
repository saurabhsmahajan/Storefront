import { classifyIntent } from "../layer2/classify.mjs";
import { planSubtasks } from "../layer2/planner.mjs";
import { FALLBACK_REPLY } from "../lib/loop.mjs";
import {
  buildHandoff,
  buildSubtaskHandoff,
  renderForSpecialist,
  validateHandoff,
} from "../lib/handoff.mjs";
import { decideEscalation } from "../lib/escalation-rules.mjs";
import { combineEscalation } from "../lib/combine.mjs";
import { handoffLineFor, mergeReplies } from "../lib/merge.mjs";
import { findOrderIds, validatePlan } from "../lib/plan.mjs";
import { runPlan } from "./run-plan.mjs";
import { runOrderStatus } from "../specialists/order-status.mjs";
import { runDecline } from "../specialists/decline.mjs";
import { runRefund } from "../specialists/refund.mjs";

const SPECIALISTS = {
  order_status: runOrderStatus,
  decline: runDecline,
  refund: runRefund,
};

const HUMAN_REPLY =
  "I'm passing you to a human agent now. They'll pick up from here.";
const OUT_OF_SCOPE_REPLY =
  "I can help with order status, payment problems and refunds. If you have an order ID, send it and I'll look into it. If you'd like to talk to a person, tell me and I'll pass you to a human agent.";
// Fixed text for an out-of-scope part of a split message. Code writes it.
export const NOT_ROUTABLE_NOTE =
  "I can't help with the other part of your message. I can help with order status, payment problems and refunds.";
const REFUND_RECOMMENDATION =
  "Full refund to the original payment method. A human decides.";

const attempt = (fn) => Promise.resolve().then(fn);

// What the receiver is given. Findings come from tool results held in code.
// They are verified; the model's text is not.
function findingsFor(route, r, subtaskId = null) {
  const tag = (f) => (subtaskId ? { subtask_id: subtaskId, ...f } : f);
  if (route === "refund" && r.decision) {
    return [tag({ source: "refund_rules", ...r.decision })];
  }
  if (route === "decline" && r.handoffRaw?.length) {
    return r.handoffRaw.map((x) =>
      tag({
        source: "payment_events",
        raw_reason: x.reason,
        disclosure_tier: x.tier,
      }),
    );
  }
  if (route === "order_status" && r.lookup) {
    return [tag({ source: "orders", ...r.lookup })];
  }
  return [];
}

async function handle(message, deps, t0) {
  const classify = deps.classify ?? classifyIntent;
  const plan = deps.plan ?? planSubtasks;
  const specialists = deps.specialists ?? SPECIALISTS;
  const orderIds = findOrderIds(message);
  const done = (route, r) => ({ route, ms: Date.now() - t0, ...r });

  // Every escalation builds a validated handoff package.
  const escalated = ({
    route,
    trigger,
    from,
    to = "human",
    r = {},
    reply,
    recommendation = null,
    findings = null,
    context = {},
  }) => {
    const handoff = buildHandoff({
      from,
      to,
      trigger,
      customerMessage: message.trim() ? message : "(empty message)",
      orderId: orderIds[0] ?? null,
      findings: findings ?? findingsFor(route, r),
      recommendation,
      agentNote: r.reply ?? null,
      customerReply: reply,
      context: { route, steps: (r.steps ?? []).length, ...context },
    });
    const v = validateHandoff(handoff);
    if (!v.ok) throw new Error(`Invalid handoff: ${v.errors.join("; ")}`);
    return done(route, {
      outcome: "escalated",
      reply,
      steps: r.steps ?? [],
      escalation: { trigger, by: "code" },
      handoff,
      forced: Boolean(r.forced),
    });
  };

  // Step 1: classifier and planner run together. R1 and R2 are decided from
  // the classifier alone, exactly as before.
  const [cls, pl] = await Promise.allSettled([
    attempt(() => classify(message)),
    attempt(() => plan(message)),
  ]);
  let route;
  let routerFailed = false;
  if (cls.status === "rejected") {
    routerFailed = true;
    route = "router_error";
  } else {
    route = cls.value?.intent;
  }
  const first = decideEscalation({
    route: routerFailed ? "router_error" : route,
  });
  if (first.escalate) {
    const human = first.trigger === "explicit_human_request";
    return escalated({
      route: routerFailed ? "router_error" : (route ?? "unknown"),
      trigger: first.trigger,
      from: "router",
      reply: human ? HUMAN_REPLY : FALLBACK_REPLY,
    });
  }
  if (route === "out_of_scope") {
    return done(route, {
      outcome: "resolved",
      reply: OUT_OF_SCOPE_REPLY,
      steps: [],
      escalation: null,
    });
  }

  // Step 2: the plan is used only if it is valid. Otherwise today's path runs.
  let usable = null;
  let planErrors = [];
  if (pl.status === "fulfilled" && pl.value?.plan) {
    const v = validatePlan(pl.value.plan, {
      message,
      orderIds,
      classifiedRoute: route,
    });
    if (v.ok) usable = pl.value.plan;
    else planErrors = v.errors;
  }

  // A human request inside a mixed message is R1: escalate now, no tools.
  if (usable?.unrouted.some((u) => u.label === "human_request")) {
    const rule = decideEscalation({ route: "human_request" });
    return escalated({
      route: "human_request",
      trigger: rule.trigger,
      from: "router",
      reply: HUMAN_REPLY,
      context: { via: "planner_unrouted" },
    });
  }

  // Step 3a: a split message. Each subtask gets its own package and runs
  // through its own specialist.
  if (usable && usable.subtasks.length >= 2) {
    const subtasks = usable.subtasks;
    const planSize = subtasks.length;
    const multiRoute = `multi:${subtasks.map((s) => s.specialist).join("+")}`;
    const idFor = (s) =>
      s.order_ref !== null
        ? orderIds[s.order_ref]
        : orderIds.length === 1
          ? orderIds[0]
          : null;

    const jobs = subtasks.map((s) => {
      const pkg = buildSubtaskHandoff({
        subtask: s,
        orderId: idFor(s),
        classification: route,
        planSize,
      });
      const v = validateHandoff(pkg);
      if (!v.ok) {
        throw new Error(`Invalid subtask package: ${v.errors.join("; ")}`);
      }
      return {
        id: s.id,
        specialist: s.specialist,
        input: renderForSpecialist(pkg),
      };
    });
    const ran = await runPlan(jobs, {
      specialists,
      concurrency: deps.concurrency ?? Infinity,
      timeoutMs: deps.timeoutMs ?? 60000,
    });

    const rows = ran.map((x, i) => ({
      s: subtasks[i],
      x,
      forced: x.status === "answered" && Boolean(x.r?.forcedReason),
    }));
    const combined = combineEscalation(
      rows.map(({ s, x }) => ({
        id: s.id,
        specialist: s.specialist,
        status: x.status,
        loop: {
          forcedReason: x.r?.forcedReason,
          toolErrors: x.r?.toolErrors,
        },
        refundDecision: x.r?.decision ?? null,
      })),
    );
    const triggerOf = Object.fromEntries(
      combined.perSubtask.map((p) => [p.id, p.trigger]),
    );
    const steps = rows.flatMap(({ s, x }) =>
      (x.r?.steps ?? []).map((st) => ({ subtask: s.id, ...st })),
    );

    // The merge only joins. A forced stop's fallback text is dropped.
    const ok = ({ x, forced }) => x.status === "answered" && !forced;
    const mergeInput = rows.map((row) => ({
      id: row.s.id,
      status: ok(row) ? "answered" : "failed",
      reply: row.x.r?.reply ?? "",
    }));
    const unanswered = rows
      .filter((row) => !ok(row))
      .map(({ s }) => ({ part: s.question, reason: "specialist_failed" }));
    const anyAnswered = mergeInput.some((m) => m.status === "answered");
    const notRoutable = usable.unrouted.filter(
      (u) => u.label === "out_of_scope",
    );
    if (notRoutable.length && anyAnswered) {
      mergeInput.push({
        id: "unrouted",
        status: "answered",
        reply: NOT_ROUTABLE_NOTE,
      });
    }
    const sessionTrigger = combined.escalate ? combined.trigger : null;
    const reply = mergeReplies({
      results: mergeInput,
      unanswered,
      sessionTrigger,
    });

    const summary = rows.map((row) => ({
      id: row.s.id,
      specialist: row.s.specialist,
      question: row.s.question,
      order_id: idFor(row.s),
      status: ok(row) ? "answered" : "failed",
      error: row.x.error,
      trigger: triggerOf[row.s.id] ?? null,
      steps: (row.x.r?.steps ?? []).length,
      start_ms: row.x.startMs,
      end_ms: row.x.endMs,
    }));

    if (combined.escalate) {
      const body = anyAnswered
        ? mergeReplies({
            results: mergeInput,
            unanswered,
            sessionTrigger: null,
          })
        : null;
      return escalated({
        route: multiRoute,
        trigger: combined.trigger,
        from: "system",
        r: { steps, reply: body, forced: !anyAnswered },
        reply,
        recommendation: summary.some(
          (x) => x.trigger === "refund_recommendation",
        )
          ? REFUND_RECOMMENDATION
          : null,
        findings: rows.flatMap(({ s, x }) =>
          findingsFor(s.specialist, x.r ?? {}, s.id),
        ),
        context: {
          multi: true,
          plan_size: planSize,
          subtasks: summary,
          unanswered: [
            ...unanswered,
            ...notRoutable.map((u) => ({
              part: u.text,
              reason: "not_routable",
            })),
          ],
        },
      });
    }
    return done(multiRoute, {
      outcome: "resolved",
      reply,
      steps,
      escalation: null,
      multi: { subtasks: summary },
    });
  }

  // Step 3b: one specialist, as before. It still gets a Router-to-specialist
  // package, and with plan_size 1 the string it receives is the raw message.
  const run = specialists[route];
  let r;
  try {
    const pkg = buildSubtaskHandoff({
      subtask: { id: "s1", specialist: route, question: message },
      orderId: orderIds[0] ?? null,
      classification: route,
      planSize: 1,
    });
    const v = validateHandoff(pkg);
    if (!v.ok) {
      throw new Error(`Invalid subtask package: ${v.errors.join("; ")}`);
    }
    r = await run(renderForSpecialist(pkg));
  } catch (err) {
    return escalated({
      route,
      trigger: "specialist_error",
      from: route,
      reply: FALLBACK_REPLY,
      r: { reply: `specialist_error: ${err.message}` },
    });
  }
  const rule = decideEscalation({
    route,
    loop: { forcedReason: r.forcedReason, toolErrors: r.toolErrors },
    refundDecision: r.decision ?? null,
  });
  const extra = planErrors.length ? { planErrors } : {};
  if (!rule.escalate) return done(route, { ...r, ...extra });

  const forced = Boolean(r.forcedReason);
  return escalated({
    route,
    trigger: rule.trigger,
    from: route,
    r,
    reply: forced
      ? FALLBACK_REPLY
      : `${r.reply}\n\n${handoffLineFor(rule.trigger)}`,
    recommendation:
      rule.trigger === "refund_recommendation" ? REFUND_RECOMMENDATION : null,
  });
}

// Every exit returns outcome "resolved" or "escalated". deps is optional and
// lets tests swap in a classifier, planner or specialists.
export async function handleMessage(message, deps = {}) {
  const t0 = Date.now();
  const text = String(message ?? "");
  try {
    return await handle(text, deps, t0);
  } catch (err) {
    // Last line of defence: any unexpected failure still ends in a human.
    let handoff = null;
    try {
      handoff = buildHandoff({
        from: "system",
        to: "human",
        trigger: "specialist_error",
        customerMessage: text.trim() ? text : "(empty message)",
        orderId: findOrderIds(text)[0] ?? null,
        findings: [],
        agentNote: `unexpected_error: ${err.message}`,
        customerReply: FALLBACK_REPLY,
        context: { route: "error", steps: 0 },
      });
    } catch {
      // no package possible: the escalation below still happens
    }
    return {
      route: "error",
      ms: Date.now() - t0,
      outcome: "escalated",
      reply: FALLBACK_REPLY,
      steps: [],
      escalation: { trigger: "specialist_error", by: "code" },
      handoff,
      forced: true,
    };
  }
}
