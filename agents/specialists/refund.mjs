import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runLoop } from "../lib/loop.mjs";
import { getOrder, getPayments } from "../lib/db.mjs";
import { decideEligibility } from "../lib/refund-rules.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SYSTEM = fs
  .readFileSync(path.join(here, "refund-prompt.txt"), "utf8")
  .trim();
const FULL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The allowlist. There is no tool that executes a refund.
const TOOLS = [
  {
    name: "check_refund_eligibility",
    description:
      "Check refund eligibility for one order. Returns a verdict (eligible, not_eligible, no_rule, not_found), a reason code and facts.",
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
  {
    name: "escalate_to_human",
    description:
      "Hand the conversation to a human agent, with the findings in the reason.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Findings and recommendation" },
      },
      required: ["reason"],
    },
  },
];

export async function runRefund(message) {
  let decision = null;
  const execute = async (name, input) => {
    if (name !== "check_refund_eligibility") {
      throw new Error(`Unknown tool: ${name}`);
    }
    const id = input?.order_id;
    if (typeof id !== "string" || !FULL_UUID.test(id)) {
      throw new Error("order_id must be a full UUID");
    }
    const order = await getOrder(id, "refund");
    const events = order ? await getPayments(id, "refund") : [];
    // Only the verdict, reason code and facts leave this function. Raw
    // payment events (including refusal reasons) never reach the model.
    decision = decideEligibility({ order, events });
    return decision;
  };
  const r = await runLoop({
    system: SYSTEM,
    tools: TOOLS,
    execute,
    message,
    maxSteps: 4,
  });
  return { ...r, decision };
}
