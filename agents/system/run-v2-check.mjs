import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODEL } from "../config.mjs";
import { fill, loadTestSet } from "../lib/testset.mjs";
import { handleMessage } from "./dispatch.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");

const X2 = {
  id: "X2",
  category: "Two orders",
  message: fill("Where is {ORD_103}, and can I get a refund on {ORD_104}?"),
};
const byId = Object.fromEntries(loadTestSet().map((r) => [r.id, r]));
const rows = [X2, byId["17"], byId["1"]];

const date = new Date().toISOString().slice(0, 10);
const out = [
  `# Specialist prompts v2 check: before and after for D6 (${date})`,
  "",
  `Model: ${MODEL}`,
  "Change: split subtasks always get an Order ID line, and the specialist prompts say to name that order in the first sentence (commit 1bbdb97). Planner prompt unchanged (v1).",
  "Messages: X2 (the defect), #17 (the other split, not expected to change) and #1 (a single-intent control, must be unchanged).",
  "Before: evidence/system-run-decompose-2026-10-06.md and evidence/system-decompose-scores-2026-10-06.md. Run once, replies unedited.",
  "",
];

for (const row of rows) {
  const r = await handleMessage(row.message);
  const subs = r.handoff?.context?.subtasks ?? r.multi?.subtasks ?? null;
  console.log(
    `#${row.id} route=${r.route} outcome=${r.outcome} subtasks=${subs ? subs.length : 0} ${r.ms}ms`,
  );
  out.push(
    `## ${row.id}. ${row.category}`,
    "",
    `Message: ${row.message}`,
    "",
    `Trace: route=${r.route}, outcome=${r.outcome}, escalation=${JSON.stringify(r.escalation ?? null)}, ms=${r.ms}`,
    "",
    "Subtasks:",
    "",
    "```json",
    JSON.stringify(
      (subs ?? []).map((s) => ({
        id: s.id,
        specialist: s.specialist,
        question: s.question,
        order_id: s.order_id,
      })),
      null,
      1,
    ),
    "```",
    "",
    "Reply:",
    "",
    ...String(r.reply)
      .split("\n")
      .map((l) => `> ${l}`),
    "",
    "Score: Correct ?, Invented ?, Escalation ?",
    "",
  );
}

const file = path.join(root, "evidence", `system-run-v2-check-${date}.md`);
fs.writeFileSync(file, out.join("\n"));
console.log(`Saved ${file}`);
