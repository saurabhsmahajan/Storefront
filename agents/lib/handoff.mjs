// Structured handoff package: Router to specialist, and specialist to human.
// Findings are built by code from tool results (verified). agent_note is the
// model's own words (unverified). Authorisation state is not an input: it is
// always "nothing approved".

export const TRIGGERS = [
  "explicit_human_request",
  "policy_gap",
  "refund_recommendation",
  "tool_failure",
  "step_cap",
  "api_error",
  "router_no_label",
  "specialist_error",
  "empty_reply",
  "unexpected_stop",
];
const DESTINATIONS = ["human", "order_status", "decline", "refund"];
const SOURCES = ["router", "order_status", "decline", "refund", "system"];

function deepFreeze(o) {
  for (const v of Object.values(o)) {
    if (v && typeof v === "object") deepFreeze(v);
  }
  return Object.freeze(o);
}

export function buildHandoff({
  from,
  to,
  trigger,
  customerMessage,
  orderId = null,
  findings = [],
  context = {},
  recommendation = null,
  agentNote = null,
  customerReply = null,
  now = new Date(),
}) {
  if (!SOURCES.includes(from)) throw new Error(`Unknown source: ${from}`);
  if (!DESTINATIONS.includes(to)) throw new Error(`Unknown destination: ${to}`);
  if (!TRIGGERS.includes(trigger))
    throw new Error(`Unknown trigger: ${trigger}`);
  return deepFreeze(
    structuredClone({
      version: 1,
      created_at: now.toISOString(),
      from,
      to,
      trigger,
      customer_message: customerMessage,
      order_id: orderId,
      findings,
      context,
      recommendation,
      agent_note: agentNote,
      customer_told: customerReply,
      authorization: {
        refund_approved: false,
        approved_by: null,
        note: "Nothing has been approved. Only a human agent can approve.",
      },
    }),
  );
}

export function validateHandoff(p) {
  const errors = [];
  if (p?.version !== 1) errors.push("version must be 1");
  if (!TRIGGERS.includes(p?.trigger)) errors.push("unknown trigger");
  if (!DESTINATIONS.includes(p?.to)) errors.push("unknown destination");
  if (typeof p?.customer_message !== "string" || !p.customer_message.trim()) {
    errors.push("customer_message is required");
  }
  if (!Array.isArray(p?.findings)) errors.push("findings must be an array");
  if (p?.authorization?.refund_approved !== false) {
    errors.push("authorization.refund_approved must be false");
  }
  if (p?.authorization?.approved_by !== null) {
    errors.push("authorization.approved_by must be null");
  }
  return { ok: errors.length === 0, errors };
}
