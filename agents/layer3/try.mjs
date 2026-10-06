import { loadTestSet } from "../lib/testset.mjs";
import { runAgent } from "./agent.mjs";

const pick = process.argv.slice(2).map(Number);
const rows = loadTestSet().filter((r) => pick.includes(Number(r.id)));

for (const row of rows) {
  const r = await runAgent(row.message);
  console.log(`\n#${row.id} ${row.message}`);
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
    r.escalation ? JSON.stringify(r.escalation) : "",
  );
  console.log("  reply:", r.reply);
}
