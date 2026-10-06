import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runLoop } from "../lib/loop.mjs";
import { INTENTS } from "../layer2/classify.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SYSTEM = fs
  .readFileSync(path.join(here, "router-prompt.txt"), "utf8")
  .trim();

// The Router's allowlist: one tool, and it touches no data.
const TOOLS = [
  {
    name: "route_to",
    description:
      "Send the customer's message to one team member. Call this once you know where it belongs.",
    input_schema: {
      type: "object",
      properties: {
        specialist: { type: "string", enum: INTENTS },
        reason: { type: "string", description: "One short sentence" },
      },
      required: ["specialist"],
    },
  },
];

export async function routeByAgent(message) {
  const t0 = Date.now();
  let route = null;
  let reason = null;
  const execute = async (name, input) => {
    if (name !== "route_to") throw new Error(`Unknown tool: ${name}`);
    if (!INTENTS.includes(input?.specialist)) {
      throw new Error(`specialist must be one of: ${INTENTS.join(", ")}`);
    }
    route = input.specialist;
    reason = input.reason ?? null;
    return { status: "routed", specialist: route };
  };
  const r = await runLoop({
    system: SYSTEM,
    tools: TOOLS,
    execute,
    message,
    maxSteps: 3,
  });
  return {
    route: route ?? (r.forced ? "failed" : "clarify"),
    reason,
    text: r.reply,
    modelCalls: r.steps.length,
    ms: Date.now() - t0,
  };
}
