import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { MODEL } from "../config.mjs";
import {
  findOrderIds,
  PLAN_SPECIALISTS,
  UNROUTED_LABELS,
} from "../lib/plan.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SYSTEM = fs
  .readFileSync(path.join(here, "plan-prompt.txt"), "utf8")
  .trim();
const client = new Anthropic();

// The planner's only tool. It records a plan and touches no data.
const TOOL = {
  name: "submit_plan",
  description: "Submit the plan for this message. Call exactly once.",
  input_schema: {
    type: "object",
    properties: {
      subtasks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            specialist: { type: "string", enum: PLAN_SPECIALISTS },
            question: { type: "string" },
            order_ref: { type: ["integer", "null"] },
          },
          required: ["id", "specialist", "question", "order_ref"],
          additionalProperties: false,
        },
      },
      unrouted: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            label: { type: "string", enum: UNROUTED_LABELS },
          },
          required: ["text", "label"],
          additionalProperties: false,
        },
      },
    },
    required: ["subtasks", "unrouted"],
    additionalProperties: false,
  },
};

// One model call. Returns the plan the model submitted, or null when it did
// not call submit_plan. Validation is a separate step (validatePlan).
export async function planSubtasks(message) {
  const t0 = Date.now();
  const orderIds = findOrderIds(message);
  const list = orderIds.length
    ? orderIds.map((id, i) => `${i}: ${id}`).join("\n")
    : "(none)";
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM,
    tools: [TOOL],
    messages: [
      {
        role: "user",
        content: `Order IDs found:\n${list}\n\n<customer_message>\n${message}\n</customer_message>`,
      },
    ],
  });
  const call = res.content.find(
    (b) => b.type === "tool_use" && b.name === "submit_plan",
  );
  return {
    plan: call ? call.input : null,
    orderIds,
    stop: res.stop_reason,
    ms: Date.now() - t0,
  };
}
