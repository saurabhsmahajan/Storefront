import { loadTestSet } from "../lib/testset.mjs";
import { runDecline } from "./decline.mjs";

const pick = process.argv.slice(2).map(Number);
const LEAK =
  /fraud|acquirer|cvc|security code|expir|not enough balance|insufficient/i;

for (const row of loadTestSet().filter((r) => pick.includes(Number(r.id)))) {
  const r = await runDecline(row.message);
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
    "  raw kept in code:",
    JSON.stringify(r.handoffRaw.map((x) => x.reason)),
  );
  console.log(
    "  leak check:",
    LEAK.test(r.reply) ? "LEAK WORDS FOUND" : "clean",
  );
  console.log("  reply:", r.reply);
}
