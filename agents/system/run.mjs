import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODEL } from "../config.mjs";
import { loadTestSet } from "../lib/testset.mjs";
import { handleMessage } from "./dispatch.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const rows = loadTestSet();
console.log(`Parsed ${rows.length} messages. Model: ${MODEL}`);

const date = new Date().toISOString().slice(0, 10);
const out = [
  `# End-to-end run: Router and three specialists (${date})`,
  "",
  `Model: ${MODEL}`,
  "Test set: evidence/test-set-2026-10-04.md. #7 to #10 are scored against the revised expectations in evidence/decline-disclosure-decision-2026-10-06.md.",
  "Flow: classifier Router, then one specialist (order_status, decline, refund), each with its own prompt, tool allowlist and credential. human_request and out_of_scope are handled in code. Any unexpected failure escalates to a human.",
  "Run once, replies unedited.",
  "",
];

for (const row of rows) {
  let r;
  try {
    r = await handleMessage(message(row));
  } catch (err) {
    r = {
      route: "crashed",
      outcome: "crashed",
      reply: `ERROR: ${err.message}`,
      steps: [],
      escalation: null,
      ms: 0,
    };
  }
  const tools = (r.steps ?? []).flatMap((s) =>
    (s.tools ?? []).map((t) => t.name),
  );
  out.push(
    `## ${row.id}. ${row.category}`,
    "",
    `Message: ${row.message}`,
    "",
    `Trace: route=${r.route}, steps=${(r.steps ?? []).length}, tools=${tools.join(", ") || "none"}, outcome=${r.outcome}, forced=${r.forced ?? false}, escalation=${JSON.stringify(r.escalation ?? null)}, ms=${r.ms}`,
    "",
    "Steps:",
    "",
    "```json",
    JSON.stringify(r.steps ?? []).slice(0, 4000),
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
  console.log(
    `#${row.id} ${r.route} ${r.outcome} steps=${(r.steps ?? []).length} ${r.ms}ms`,
  );
}

function message(row) {
  return row.message;
}

const file = path.join(root, "evidence", `system-run-${date}.md`);
fs.writeFileSync(file, out.join("\n"));
console.log(`Saved ${file}`);
