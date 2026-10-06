import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODEL } from "../config.mjs";
import { loadTestSet } from "../lib/testset.mjs";
import { handle } from "./workflow.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const rows = loadTestSet();
console.log(`Parsed ${rows.length} messages. Model: ${MODEL}`);

const date = new Date().toISOString().slice(0, 10);
const out = [
  `# Layer 2 run: fixed workflow (${date})`,
  "",
  `Model: ${MODEL}`,
  "Test set: evidence/test-set-2026-10-04.md",
  "Steps: classify intent, one fixed lookup (specialist credential), write answer.",
  "Run once, replies unedited.",
  "",
];

for (const row of rows) {
  let result;
  try {
    result = await handle(row.message);
  } catch (err) {
    result = {
      reply: `ERROR: ${err.message}`,
      stop: "error",
      trace: { intent: "?", lookup: { status: "?" } },
    };
  }
  const t = result.trace;
  out.push(
    `## ${row.id}. ${row.category}`,
    "",
    `Message: ${row.message}`,
    "",
    `Trace: intent=${t.intent}, credential=${t.credential ?? "none"}, lookup=${t.lookup.status}, escalate=${t.escalate ?? false}`,
    "",
    "Lookup data:",
    "",
    "```json",
    JSON.stringify(t.lookup).slice(0, 1500),
    "```",
    "",
    "Reply:",
    "",
    ...result.reply.split("\n").map((l) => `> ${l}`),
    "",
    `Stop reason: ${result.stop}`,
    "Score: Correct ?, Invented ?, Escalation ?",
    "",
  );
  console.log(`#${row.id} ${t.intent} / ${t.lookup.status}`);
}

const file = path.join(root, "evidence", `layer2-run-${date}.md`);
fs.writeFileSync(file, out.join("\n"));
console.log(`Saved ${file}`);
