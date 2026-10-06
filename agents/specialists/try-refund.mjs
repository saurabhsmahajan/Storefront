import { loadTestSet } from "../lib/testset.mjs";
import { runRefund } from "./refund.mjs";

const pick = process.argv.slice(2).map(Number);

for (const row of loadTestSet().filter((r) => pick.includes(Number(r.id)))) {
  const r = await runRefund(row.message);
  const d = r.decision;
  const mustEscalate = d && ["eligible", "no_rule"].includes(d.verdict);
  console.log(`\n#${row.id} ${row.message}`);
  for (const s of r.steps) {
    console.log(
      "  step",
      s.step,
      s.stop ?? s.error,
      JSON.stringify(s.tools ?? []),
      s.violations ? `VIOLATIONS ${s.violations}` : "",
    );
  }
  console.log(
    "  decision:",
    d ? `${d.verdict} / ${d.reason ?? "-"}` : "no lookup",
  );
  console.log(
    "  outcome:",
    r.outcome,
    r.escalation ? JSON.stringify(r.escalation) : "",
  );
  if (mustEscalate && !r.escalation) {
    console.log("  CHECK: escalation expected but not made");
  }
  console.log("  reply:", r.reply);
}
