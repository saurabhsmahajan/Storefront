import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTestSet } from "../lib/testset.mjs";
import { validatePlan } from "../lib/plan.mjs";
import { classifyIntent } from "./classify.mjs";
import { planSubtasks } from "./planner.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const date = new Date().toISOString().slice(0, 10);
const out = [
  `# Planner dry run v1 (${date})`,
  "",
  "Planner prompt: agents/layer2/plan-prompt.txt, v1, frozen before this run. Criteria: evidence/planner-dry-run-criteria-2026-10-06.md. Nothing is wired into dispatch: this run only records plans. Run once.",
  "",
];
const counts = { multi: 0, single: 0, fallback: 0, noPlan: 0 };

for (const row of loadTestSet()) {
  const [cls, pl] = await Promise.all([
    classifyIntent(row.message).catch((e) => ({
      intent: null,
      raw: `ERROR ${e.message}`,
    })),
    planSubtasks(row.message).catch((e) => ({
      plan: null,
      orderIds: [],
      stop: `ERROR ${e.message}`,
      ms: 0,
    })),
  ]);
  let kind;
  let errors = [];
  if (!pl.plan) {
    kind = "no_plan";
    counts.noPlan++;
  } else {
    const v = validatePlan(pl.plan, {
      message: row.message,
      orderIds: pl.orderIds,
      classifiedRoute: cls.intent,
    });
    errors = v.errors;
    kind = !v.ok
      ? "fallback"
      : pl.plan.subtasks.length >= 2
        ? "multi"
        : "single";
    counts[kind]++;
  }
  const subs =
    (pl.plan?.subtasks ?? []).map((s) => s.specialist).join("+") || "-";
  const unr = (pl.plan?.unrouted ?? []).map((u) => u.label).join(",") || "-";
  console.log(
    `#${row.id} route=${cls.intent} plan=${kind} subtasks=${subs} unrouted=${unr} ${pl.ms}ms`,
  );
  if (errors.length) console.log(`   errors: ${errors.join(" | ")}`);
  out.push(
    `## ${row.id}. ${row.category}`,
    "",
    `Message: ${row.message}`,
    "",
    `Classifier route: ${cls.intent}. Planner: ${kind}, ${pl.ms} ms, stop ${pl.stop}.`,
    errors.length ? `Validation errors: ${errors.join(" | ")}` : "",
    "",
    "```json",
    JSON.stringify(pl.plan, null, 1),
    "```",
    "",
  );
}

console.log("\ncounts:", JSON.stringify(counts));
out.push(`Counts: ${JSON.stringify(counts)}`);
const file = path.join(root, "evidence", `planner-dry-run-v1-${date}.md`);
fs.writeFileSync(file, out.join("\n"));
console.log(`Saved ${file}`);
