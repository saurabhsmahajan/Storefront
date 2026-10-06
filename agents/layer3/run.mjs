import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODEL } from "../config.mjs";
import { loadTestSet } from "../lib/testset.mjs";
import { runAgent } from "./agent.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const rows = loadTestSet();
console.log(`Parsed ${rows.length} messages. Model: ${MODEL}`);

const date = new Date().toISOString().slice(0, 10);
const out = [
  `# Layer 3 run: agent with hand-written loop (${date})`,
  "",
  `Model: ${MODEL}`,
  "Test set: evidence/test-set-2026-10-04.md",
  "Agent: agents/layer3/agent.mjs. Tools: get_order, get_payment_events,",
  "escalate_to_human. Step cap 6. One credential (refund) reads both tables.",
  "Run once, replies unedited.",
  "",
];

for (const row of rows) {
  const t0 = Date.now();
  let r;
  try {
    r = await runAgent(row.message);
  } catch (err) {
    r = {
      outcome: "crashed",
      reply: `ERROR: ${err.message}`,
      steps: [],
      escalation: null,
    };
  }
  const ms = Date.now() - t0;
  const tools = r.steps.flatMap((s) => (s.tools ?? []).map((t) => t.name));
  out.push(
    `## ${row.id}. ${row.category}`,
    "",
    `Message: ${row.message}`,
    "",
    `Trace: steps=${r.steps.length}, tools=${tools.join(", ") || "none"}, outcome=${r.outcome}, forced=${r.forced ?? false}, escalation=${JSON.stringify(r.escalation)}, ms=${ms}`,
    "",
    "Steps:",
    "",
    "```json",
    JSON.stringify(r.steps).slice(0, 4000),
    "```",
    "",
    "Reply:",
    "",
    ...r.reply.split("\n").map((l) => `> ${l}`),
    "",
    "Score: Correct ?, Invented ?, Escalation ?",
    "",
  );
  console.log(
    `#${row.id} ${r.outcome} steps=${r.steps.length} tools=${tools.length} ${ms}ms`,
  );
}

const file = path.join(root, "evidence", `layer3-run-${date}.md`);
fs.writeFileSync(file, out.join("\n"));
console.log(`Saved ${file}`);
