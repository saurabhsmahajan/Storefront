import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODEL } from "../config.mjs";
import { fill } from "../lib/testset.mjs";
import { buildSubtaskHandoff, renderForSpecialist } from "../lib/handoff.mjs";
import { findOrderIds } from "../lib/plan.mjs";
import { runPlan } from "./run-plan.mjs";
import { runOrderStatus } from "../specialists/order-status.mjs";
import { runDecline } from "../specialists/decline.mjs";
import { runRefund } from "../specialists/refund.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const RUNS = 5;

// X1, with a fixed plan so planner variance cannot change the comparison.
const message = fill(
  "For order {ORD_105}: what's its status, why did my payment fail, and can I get a refund?",
);
const orderIds = findOrderIds(message);
const subtasks = [
  { id: "s1", specialist: "order_status", question: "what's its status" },
  { id: "s2", specialist: "decline", question: "why did my payment fail" },
  { id: "s3", specialist: "refund", question: "can I get a refund?" },
];
const jobs = subtasks.map((s) => {
  const pkg = buildSubtaskHandoff({
    subtask: s,
    orderId: orderIds[0],
    classification: "order_status",
    planSize: subtasks.length,
  });
  return {
    id: s.id,
    specialist: s.specialist,
    input: renderForSpecialist(pkg),
  };
});
const specialists = {
  order_status: runOrderStatus,
  decline: runDecline,
  refund: runRefund,
};

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

const rows = [];
for (const mode of ["parallel", "sequential"]) {
  for (let i = 1; i <= RUNS; i++) {
    const t0 = Date.now();
    const res = await runPlan(jobs, {
      specialists,
      concurrency: mode === "parallel" ? Infinity : 1,
    });
    const session = Date.now() - t0;
    const per = res.map((r) => r.endMs - r.startMs);
    const failed = res.filter((r) => r.status !== "answered").length;
    rows.push({
      mode,
      run: i,
      session,
      sum: per.reduce((a, b) => a + b, 0),
      max: Math.max(...per),
      per,
      failed,
    });
    console.log(
      `${mode} run ${i}: session ${session} ms | subtasks ${per.join(", ")} ms | sum ${per.reduce((a, b) => a + b, 0)} | max ${Math.max(...per)} | failed ${failed}`,
    );
  }
}

const summary = ["parallel", "sequential"].map((mode) => {
  const m = rows.filter((r) => r.mode === mode);
  return {
    mode,
    session: median(m.map((r) => r.session)),
    lo: Math.min(...m.map((r) => r.session)),
    hi: Math.max(...m.map((r) => r.session)),
    sum: median(m.map((r) => r.sum)),
    max: median(m.map((r) => r.max)),
    failed: m.reduce((a, r) => a + r.failed, 0),
  };
});
for (const s of summary) {
  console.log(
    `${s.mode}: median session ${s.session} ms (range ${s.lo} to ${s.hi}), median sum of subtasks ${s.sum} ms, median longest subtask ${s.max} ms, failed subtasks ${s.failed}`,
  );
}

const date = new Date().toISOString().slice(0, 10);
const out = [
  `# Timing: parallel against sequential (${date})`,
  "",
  `Model: ${MODEL}`,
  "Message: X1, the three-part request (status, decline, refund) for order 105, with a fixed plan so the planner's variance cannot change the comparison. Real specialists, real model calls. Only the subtask phase is timed: the classifier and planner run before it and are the same in both modes.",
  `Runs: ${RUNS} per mode, parallel first, then sequential (concurrency 1). Script: agents/system/timing.mjs.`,
  "",
  "| mode | median session ms | range ms | median sum of subtasks ms | median longest subtask ms | failed subtasks |",
  "|---|---|---|---|---|---|",
  ...summary.map(
    (s) =>
      `| ${s.mode} | ${s.session} | ${s.lo} to ${s.hi} | ${s.sum} | ${s.max} | ${s.failed} |`,
  ),
  "",
  "Per run:",
  "",
  "| mode | run | session ms | subtask ms (s1, s2, s3) | sum | longest | failed |",
  "|---|---|---|---|---|---|---|",
  ...rows.map(
    (r) =>
      `| ${r.mode} | ${r.run} | ${r.session} | ${r.per.join(", ")} | ${r.sum} | ${r.max} | ${r.failed} |`,
  ),
  "",
];
const file = path.join(
  root,
  "evidence",
  `timing-parallel-vs-sequential-${date}.md`,
);
fs.writeFileSync(file, out.join("\n"));
console.log(`Saved ${file}`);
