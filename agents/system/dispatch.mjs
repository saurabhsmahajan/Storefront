import { classifyIntent } from "../layer2/classify.mjs";
import { FALLBACK_REPLY } from "../lib/loop.mjs";
import { buildHandoff, validateHandoff } from "../lib/handoff.mjs";
import { decideEscalation } from "../lib/escalation-rules.mjs";
import { runOrderStatus } from "../specialists/order-status.mjs";
import { runDecline } from "../specialists/decline.mjs";
import { runRefund } from "../specialists/refund.mjs";

const SPECIALISTS = {
  order_status: runOrderStatus,
  decline: runDecline,
  refund: runRefund,
};
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const HUMAN_REPLY =
  "I'm passing you to a human agent now. They'll pick up from here.";
const OUT_OF_SCOPE_REPLY =
  "I can help with order status, payment problems and refunds. If you have an order ID, send it and I'll look into it. If you'd like to talk to a person, tell me and I'll pass you to a human agent.";

// Fixed sentence appended at the handoff point. The model never writes it.
const HANDOFF_LINES = {
  refund_recommendation:
    "I'm passing your case to a human agent with this information. A human agent decides every refund.",
  policy_gap:
    "I'm passing your case to a human agent with this information. They will look into it and decide what happens next.",
  tool_failure: FALLBACK_REPLY,
  step_cap: FALLBACK_REPLY,
  api_error: FALLBACK_REPLY,
  router_no_label: FALLBACK_REPLY,
  specialist_error: FALLBACK_REPLY,
  empty_reply: FALLBACK_REPLY,
  unexpected_stop: FALLBACK_REPLY,
};

// What the receiver is given about each trigger. Findings come from tool
// results held in code. They are verified; the model's text is not.
function findingsFor(route, r) {
  if (route === "refund" && r.decision) {
    return [{ source: "refund_rules", ...r.decision }];
  }
  if (route === "decline" && r.handoffRaw?.length) {
    return r.handoffRaw.map((x) => ({
      source: "payment_events",
      raw_reason: x.reason,
      disclosure_tier: x.tier,
    }));
  }
  return [];
}

// Every exit returns outcome "resolved" or "escalated". Whenever the rules
// say escalate, a validated handoff package is built.
export async function handleMessage(message) {
  const t0 = Date.now();
  const orderId = message.match(UUID)?.[0] ?? null;
  const done = (route, r) => ({ route, ms: Date.now() - t0, ...r });

  const escalated = ({
    route,
    trigger,
    from,
    to = "human",
    r = {},
    reply,
    recommendation = null,
  }) => {
    const handoff = buildHandoff({
      from,
      to,
      trigger,
      customerMessage: message,
      orderId,
      findings: findingsFor(route, r),
      recommendation,
      agentNote: r.reply ?? null,
      customerReply: reply,
      context: { route, steps: (r.steps ?? []).length },
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

  // Step 1: classify. R1 and R2 are decided here, before any specialist.
  let route;
  let routerFailed = false;
  try {
    route = (await classifyIntent(message)).intent;
  } catch (err) {
    routerFailed = true;
    route = "router_error";
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

  // Step 2: run the specialist, then apply the rules to what happened.
  const run = SPECIALISTS[route];
  let r;
  try {
    r = await run(message);
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
  if (!rule.escalate) return done(route, r);

  const forced = Boolean(r.forcedReason);
  const line = HANDOFF_LINES[rule.trigger] ?? FALLBACK_REPLY;
  return escalated({
    route,
    trigger: rule.trigger,
    from: route,
    r,
    reply: forced ? FALLBACK_REPLY : `${r.reply}\n\n${line}`,
    recommendation:
      rule.trigger === "refund_recommendation"
        ? "Full refund to the original payment method. A human decides."
        : null,
  });
}
