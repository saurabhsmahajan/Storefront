import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runLoop } from "../lib/loop.mjs";
import { handleMessage } from "./dispatch.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const A = "5eed0000-0000-4000-8000-000000000103";
const B = "5eed0000-0000-4000-8000-000000000105";

const TOOL = {
  name: "get_order_status",
  description: "Look up one order by its order ID.",
  input_schema: {
    type: "object",
    properties: { order_id: { type: "string" } },
    required: ["order_id"],
  },
};
const asOrderStatus = {
  classify: async () => ({ intent: "order_status", raw: "order_status" }),
};
const specialist =
  ({ system, execute, maxSteps }) =>
  (message) =>
    runLoop({ system, tools: [TOOL], execute, message, maxSteps });

const cases = [
  {
    rule: "R2",
    name: "the Router returns no valid label",
    expect: "router_no_label",
    message: `Where is order ${A}?`,
    deps: { classify: async () => ({ intent: null, raw: "" }) },
  },
  {
    rule: "R2",
    name: "the Router call fails",
    expect: "api_error",
    message: `Where is order ${A}?`,
    deps: {
      classify: async () => {
        throw new Error("simulated router outage");
      },
    },
  },
  {
    rule: "R3",
    name: "a specialist loop never finishes; the step cap stops it",
    expect: "step_cap",
    message: `Where is order ${A}?`,
    deps: {
      ...asOrderStatus,
      specialists: {
        order_status: specialist({
          system:
            "You are a test specialist. Call get_order_status for the order in the message. If the result says the lookup is still processing, call it again with the same order_id.",
          execute: async () => ({
            found: false,
            note: "Lookup still processing. Call the same tool again.",
          }),
          maxSteps: 3,
        }),
      },
    },
  },
  {
    rule: "R3",
    name: "a specialist crashes",
    expect: "specialist_error",
    message: `Where is order ${A}?`,
    deps: {
      ...asOrderStatus,
      specialists: {
        order_status: async () => {
          throw new Error("simulated specialist crash");
        },
      },
    },
  },
  {
    rule: "R4",
    name: "two tool errors in one session",
    expect: "tool_failure",
    message: `Where are orders ${A} and ${B}?`,
    deps: {
      ...asOrderStatus,
      specialists: {
        order_status: specialist({
          system:
            "You are a test specialist. Call get_order_status once for each order ID in the customer's message. If a call fails, still try the other ID.",
          execute: async () => {
            throw new Error("simulated tool timeout");
          },
          maxSteps: 4,
        }),
      },
    },
  },
];

const date = new Date().toISOString().slice(0, 10);
const out = [
  `# Escalation rules R2 to R4: injected failures (${date})`,
  "",
  "Each case replaces one part of the system with a stand-in that fails. The dispatch code, the escalation rules and the handoff builder are the real ones. Script: agents/system/rule-transcripts.mjs.",
  "",
];

for (const c of cases) {
  const r = await handleMessage(c.message, {
    plan: async () => ({ plan: null }),
    ...c.deps,
  });
  const errors = (r.steps ?? [])
    .flatMap((s) => s.results ?? [])
    .filter((x) => x.is_error).length;
  const trigger = r.handoff?.trigger ?? null;
  const verdict = trigger === c.expect ? "AS EXPECTED" : "DIFFERENT";
  console.log(
    `${c.rule} | ${c.name} | trigger=${trigger} | expected=${c.expect} | ${verdict} | outcome=${r.outcome} | forced=${r.forced} | tool errors=${errors} | steps=${(r.steps ?? []).length}`,
  );
  out.push(
    `## ${c.rule}: ${c.name}`,
    "",
    `Message: ${c.message}`,
    `Expected trigger: ${c.expect}`,
    `Result: trigger=${trigger}, outcome=${r.outcome}, forced=${r.forced}, tool errors=${errors}, steps=${(r.steps ?? []).length} (${verdict})`,
    "",
    "Handoff package:",
    "",
    "```json",
    JSON.stringify(r.handoff ?? null, null, 1),
    "```",
    "",
    "Reply:",
    "",
    ...String(r.reply)
      .split("\n")
      .map((l) => `> ${l}`),
    "",
  );
}

const file = path.join(
  root,
  "evidence",
  `escalation-failure-transcripts-run-${date}.md`,
);
fs.writeFileSync(file, out.join("\n"));
console.log(`Saved ${file}`);
