import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runLoop } from "../lib/loop.mjs";
import { getOrder } from "../lib/db.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SYSTEM = fs
  .readFileSync(path.join(here, "order-status-prompt.txt"), "utf8")
  .trim();
const FULL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The allowlist: this specialist can call this one tool and nothing else.
const TOOLS = [
  {
    name: "get_order_status",
    description:
      "Look up one order by its order ID. Returns status, total, order date and age in days. Returns found false if no such order exists.",
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

export async function runOrderStatus(message) {
  let lookup = null; // last lookup, kept in code for the handoff findings
  const execute = async (name, input) => {
    if (name !== "get_order_status") throw new Error(`Unknown tool: ${name}`);
    const id = input?.order_id;
    if (typeof id !== "string" || !FULL_UUID.test(id)) {
      throw new Error("order_id must be a full UUID");
    }
    const o = await getOrder(id, "order_status");
    if (!o) {
      lookup = { order_id: id, found: false };
      return { found: false };
    }
    const out = {
      found: true,
      status: o.status,
      total: `${(o.total_minor / 100).toFixed(2)} ${o.currency}`,
      order_date: o.created_at.slice(0, 10),
      age_days: Math.floor((Date.now() - new Date(o.created_at)) / 86400000),
    };
    lookup = { order_id: id, ...out };
    return out;
  };
  const r = await runLoop({
    system: SYSTEM,
    tools: TOOLS,
    execute,
    message,
    maxSteps: 4,
  });
  return { ...r, lookup };
}
