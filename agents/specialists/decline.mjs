import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runLoop } from "../lib/loop.mjs";
import { getPayments } from "../lib/db.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SYSTEM = fs
  .readFileSync(path.join(here, "decline-prompt.txt"), "utf8")
  .trim();
const MAPPING = JSON.parse(
  fs.readFileSync(
    path.join(here, "..", "data", "decline-reasons.json"),
    "utf8",
  ),
);
const FULL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The allowlist: this specialist can call these two tools and nothing else.
const TOOLS = [
  {
    name: "get_decline_info",
    description:
      "Look up the payment events for one order and return customer-safe explanations for each declined attempt. Returns found_events false if there are none.",
    input_schema: {
      type: "object",
      properties: {
        order_id: {
          type: "string",
          description: "The full order ID (a UUID) from the customer's message",
        },
      },
      required: ["order_id"],
    },
  },
];

// Applies the approved disclosure rule in code. The model never sees a raw
// never_tell or category reason.
export function explain(rawReason) {
  const entry = MAPPING.reasons[rawReason];
  const tier = entry?.tier ?? MAPPING.default_tier;
  const text = tier === "plain" ? entry.text : MAPPING.tiers[tier];
  return { tier, text };
}

export async function runDecline(message) {
  const handoffRaw = []; // kept in code for the human handoff (step G)
  const execute = async (name, input) => {
    if (name !== "get_decline_info") throw new Error(`Unknown tool: ${name}`);
    const id = input?.order_id;
    if (typeof id !== "string" || !FULL_UUID.test(id)) {
      throw new Error("order_id must be a full UUID");
    }
    const events = await getPayments(id, "decline");
    const declined = [];
    const other = [];
    for (const e of events) {
      const success = e.payload?.success;
      if (e.event_type === "AUTHORISATION" && success === "false") {
        const reason = e.payload?.reason;
        const { tier, text } = explain(reason);
        declined.push({ attempt: declined.length + 1, explanation: text });
        handoffRaw.push({ order_id: id, reason, tier });
      } else {
        other.push({ event: e.event_type, success });
      }
    }
    return {
      found_events: events.length > 0,
      declined_attempts: declined,
      other_events: other,
    };
  };
  const r = await runLoop({
    system: SYSTEM,
    tools: TOOLS,
    execute,
    message,
    maxSteps: 4,
  });
  return { ...r, handoffRaw };
}
