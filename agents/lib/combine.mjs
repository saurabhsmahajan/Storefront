// Pure function: combines per-subtask escalation decisions into one session
// decision. No I/O, no model. Each answered subtask goes through
// decideEscalation exactly as dispatch does for a single route.

import { decideEscalation } from "./escalation-rules.mjs";

// Highest first. Failures outrank verdicts, so the human sees the worst thing.
export const TRIGGER_PRIORITY = [
  "api_error",
  "step_cap",
  "empty_reply",
  "unexpected_stop",
  "specialist_error",
  "tool_failure",
  "policy_gap",
  "refund_recommendation",
];

// A trigger not in the list still escalates; it ranks below every listed one.
const rank = (t) => {
  const i = TRIGGER_PRIORITY.indexOf(t);
  return i === -1 ? TRIGGER_PRIORITY.length : i;
};

function triggerFor(r) {
  if (r.status === "failed") return "specialist_error";
  if (r.status !== "answered") return null; // skipped, not_run
  const d = decideEscalation({
    route: r.specialist,
    loop: {
      forcedReason: r.loop?.forcedReason,
      toolErrors: r.loop?.toolErrors,
    },
    refundDecision: r.refundDecision ?? null,
  });
  return d.escalate ? d.trigger : null;
}

export function combineEscalation(results) {
  const perSubtask = results.map((r) => ({ id: r.id, trigger: triggerFor(r) }));
  const fired = perSubtask.map((p) => p.trigger).filter(Boolean);
  if (!fired.length) return { escalate: false, trigger: null, perSubtask };
  const trigger = fired.reduce((a, b) => (rank(b) < rank(a) ? b : a));
  return { escalate: true, trigger, perSubtask };
}
