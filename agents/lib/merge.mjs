// Pure function: joins subtask replies into one customer reply. Code writes
// the merge, not a model. Specialist replies are joined as they are: never
// rewritten, trimmed or reordered.

import { FALLBACK_REPLY } from "./loop.mjs";

// Copied verbatim from HANDOFF_LINES in agents/system/dispatch.mjs.
export const REFUND_RECOMMENDATION_LINE =
  "I'm passing your case to a human agent with this information. A human agent decides every refund.";
export const POLICY_GAP_LINE =
  "I'm passing your case to a human agent with this information. They will look into it and decide what happens next.";
export const UNANSWERED_PREFIX = "I couldn't check this part just now: ";

export function handoffLineFor(trigger) {
  if (trigger === "refund_recommendation") return REFUND_RECOMMENDATION_LINE;
  if (trigger === "policy_gap") return POLICY_GAP_LINE;
  return FALLBACK_REPLY;
}

export function mergeReplies({
  results,
  unanswered = [],
  sessionTrigger = null,
}) {
  const answered = results.filter((r) => r.status === "answered");
  if (!answered.length) return FALLBACK_REPLY;
  const blocks = answered.map((r) => r.reply);
  for (const u of unanswered) blocks.push(`${UNANSWERED_PREFIX}"${u.part}"`);
  if (sessionTrigger) blocks.push(handoffLineFor(sessionTrigger));
  return blocks.join("\n\n");
}
