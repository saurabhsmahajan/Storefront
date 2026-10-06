import { loadTestSet } from "../lib/testset.mjs";
import { loadExpectedRoutes } from "./expected.mjs";
import { routeByAgent } from "./agentic-router.mjs";

const expected = loadExpectedRoutes();
let hit = 0;
let totalMs = 0;
let calls = 0;

for (const row of loadTestSet()) {
  const r = await routeByAgent(row.message);
  const ok = expected[row.id].includes(r.route);
  hit += ok ? 1 : 0;
  totalMs += r.ms;
  calls += r.modelCalls;
  console.log(
    `#${row.id} ${r.route} | expected ${expected[row.id].join(" or ")} | ${ok ? "OK" : "MISS"} | calls ${r.modelCalls} | ${r.ms}ms`,
  );
  if (r.route === "clarify" || r.route === "failed") {
    console.log("   text:", r.text);
  }
}
console.log(`\ncorrect ${hit}/21, model calls ${calls}, total ${totalMs}ms`);
