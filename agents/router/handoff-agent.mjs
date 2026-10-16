// Step F follow-up: code-owned escalation and handoff around the SDK agent.
// The model never decides to hand off and never writes the handoff line. Code does,
// with the same rules (agents/lib/escalation-rules.mjs) and package
// (agents/lib/handoff.mjs) as Week 2.
import { classifyIntent } from "../layer2/classify.mjs";
import { decideEscalation } from "../lib/escalation-rules.mjs";
import { buildHandoff, validateHandoff } from "../lib/handoff.mjs";
import { FALLBACK_REPLY } from "../lib/loop.mjs";
import { handoffLineFor } from "../lib/merge.mjs";
import { bareName } from "../mcp/prerequisites.mjs";
import { runSdkRouter } from "./sdk-router.mjs";

export const HUMAN_REPLY =
  "I'm passing you to a human agent now. They'll pick up from here.";
const REFUND_RECOMMENDATION =
  "Full refund to the original payment method. A human decides.";
const FULL_UUID =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Findings come from tool results held in code (verified), never from the model's text.
export function findingsFrom(toolResults = []) {
  return toolResults
    .filter((r) => !r.isError && r.body && typeof r.body === "object")
    .map((r) => ({ source: `mcp:${bareName(r.name)}`, ...r.body }));
}

export async function handleWithHandoff(message, deps = {}) {
  const classify = deps.classify ?? classifyIntent;
  const runAgent = deps.runAgent ?? runSdkRouter;
  const t0 = Date.now();
  const orderId = message.match(FULL_UUID)?.[0]?.toLowerCase() ?? null;

  const escalated = ({
    trigger,
    route,
    r = {},
    reply,
    recommendation = null,
  }) => {
    const handoff = buildHandoff({
      from:
        route === "router_error" || route === "human_request"
          ? "router"
          : "system",
      to: "human",
      trigger,
      customerMessage: message.trim() ? message : "(empty message)",
      orderId,
      findings: findingsFrom(r.toolResults),
      recommendation,
      agentNote: r.reply ?? null,
      customerReply: reply,
      context: { route, tool_calls: (r.toolCalls ?? []).length },
    });
    const v = validateHandoff(handoff);
    if (!v.ok) throw new Error(`Invalid handoff: ${v.errors.join("; ")}`);
    return {
      route,
      outcome: "escalated",
      reply,
      escalation: { trigger, by: "code" },
      handoff,
      toolCalls: r.toolCalls ?? [],
      hookLog: r.hookLog ?? [],
      ms: Date.now() - t0,
    };
  };

  // Step 1: classify. R1 (human request) and router failures escalate before any tool runs.
  let route;
  let routerFailed = false;
  try {
    route = (await classify(message))?.intent;
  } catch {
    routerFailed = true;
  }
  const first = decideEscalation({
    route: routerFailed ? "router_error" : route,
  });
  if (first.escalate) {
    const human = first.trigger === "explicit_human_request";
    return escalated({
      trigger: first.trigger,
      route: routerFailed ? "router_error" : (route ?? "unknown"),
      reply: human ? HUMAN_REPLY : FALLBACK_REPLY,
    });
  }

  // Step 2: the agent runs. Any crash escalates.
  let r;
  try {
    r = await runAgent(message, deps.agentOptions);
  } catch (err) {
    return escalated({
      trigger: "specialist_error",
      route,
      r: { reply: `agent_error: ${err.message}` },
      reply: FALLBACK_REPLY,
    });
  }

  // Step 3: the rules read the tool results, not the model's words.
  const refund = r.toolResults?.find(
    (x) => bareName(x.name) === "check_refund_eligibility" && !x.isError,
  )?.body;
  const rule = decideEscalation({
    route,
    loop: {
      forcedReason: r.forcedReason,
      toolErrors: (r.toolResults ?? []).filter((x) => x.isError).length,
    },
    refundDecision: refund ?? null,
  });
  if (!rule.escalate) {
    return {
      route,
      outcome: "resolved",
      reply: r.reply,
      escalation: null,
      handoff: null,
      toolCalls: r.toolCalls,
      hookLog: r.hookLog,
      ms: Date.now() - t0,
    };
  }
  const forced = Boolean(r.forcedReason);
  return escalated({
    trigger: rule.trigger,
    route,
    r,
    reply: forced
      ? FALLBACK_REPLY
      : `${r.reply}\n\n${handoffLineFor(rule.trigger)}`,
    recommendation:
      rule.trigger === "refund_recommendation" ? REFUND_RECOMMENDATION : null,
  });
}
