// Pure function: decides whether to escalate and why. No I/O, no model.
// Priority: human request, router failure, forced loop failure, repeated tool
// failure, policy gap, refund recommendation.

function triggerForForced(reason) {
  const r = String(reason);
  if (r === "step_cap") return "step_cap";
  if (r.startsWith("api_error")) return "api_error";
  if (r === "empty_final_reply") return "empty_reply";
  if (r.startsWith("unexpected_stop_reason")) return "unexpected_stop";
  return "specialist_error"; // unknown failures still escalate
}

export function decideEscalation({
  route,
  loop = {},
  refundDecision = null,
} = {}) {
  const yes = (trigger, tryToolsFirst) => ({
    escalate: true,
    trigger,
    tryToolsFirst,
  });
  if (route === "human_request") return yes("explicit_human_request", false);
  if (route === "router_error") return yes("api_error", false);
  if (!route || route === "unknown") return yes("router_no_label", false);
  if (loop.forcedReason) return yes(triggerForForced(loop.forcedReason), true);
  if ((loop.toolErrors ?? 0) >= 2) return yes("tool_failure", true);
  const verdict = refundDecision?.verdict;
  if (verdict === "no_rule") return yes("policy_gap", true);
  if (verdict === "eligible") return yes("refund_recommendation", true);
  return { escalate: false, trigger: null, tryToolsFirst: false };
}
