import { runAgent } from "./agent.mjs";

const ID = "5eed0000-0000-4000-8000-000000000103";

function show(label, r) {
  console.log(`\n${label}`);
  for (const s of r.steps) {
    console.log(
      "  step",
      s.step,
      s.stop ?? s.error,
      JSON.stringify(s.tools ?? []),
    );
  }
  console.log(
    "  outcome:",
    r.outcome,
    "| forced:",
    r.forced ?? false,
    "|",
    JSON.stringify(r.escalation),
  );
  console.log("  reply:", r.reply);
}

// Case A: deterministic. Cap of 1 step, the message needs a tool call.
show("A: cap = 1", await runAgent(`Where is my order ${ID}?`, { maxSteps: 1 }));

// Case B: a lookup that never completes, cap of 4.
const neverDone = async () => ({
  found: false,
  note: "Lookup still processing. Call the same tool again with the same order_id.",
});
show(
  "B: never-finishing lookup, cap = 4",
  await runAgent(`Where is my order ${ID}?`, {
    execute: neverDone,
    maxSteps: 4,
  }),
);
