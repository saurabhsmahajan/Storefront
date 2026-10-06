import { loadTestSet } from "../lib/testset.mjs";
import { runOrderStatus } from "./order-status.mjs";

const pick = process.argv.slice(2).map(Number);
// This specialist has no payment data, so any of these words is a claim it
// cannot ground.
const PAYMENT_WORDS = /declin|attempt|authoris|captur|refus/i;

for (const row of loadTestSet().filter((r) => pick.includes(Number(r.id)))) {
  const r = await runOrderStatus(row.message);
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
    "  outcome:",
    r.outcome,
    r.escalation ? JSON.stringify(r.escalation) : "",
  );
  console.log(
    "  payment words:",
    PAYMENT_WORDS.test(r.reply) ? "FOUND, check the reply" : "none",
  );
  console.log("  reply:", r.reply);
}
