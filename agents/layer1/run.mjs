import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { MODEL, MAX_TOKENS } from "../config.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const read = (p) => fs.readFileSync(p, "utf8");

// System prompt = prompt text + refund policy. No order data, no tools.
const systemPrompt =
  read(path.join(here, "system-prompt.txt")).trim() +
  "\n\n" +
  read(path.join(root, "agents", "data", "refund-policy.txt")).trim();

// Messages come straight from the dated test set.
const testSet = read(path.join(root, "evidence", "test-set-2026-10-04.md"));
const section = testSet.split("## Messages")[1].split("## Known limits")[0];
const rows = section
  .split("\n")
  .filter((line) => /^\|\s*\d+\s*\|/.test(line))
  .map((line) => line.split("|").map((c) => c.trim()))
  .map((c) => ({ id: c[1], category: c[2], message: c[3] }));

if (rows.length !== 21) {
  throw new Error(`Expected 21 messages, parsed ${rows.length}`);
}
console.log(`Parsed ${rows.length} messages. Model: ${MODEL}`);

const fill = (m) =>
  m.replace(
    /\{ORD_(\d{3}|MISSING)\}/g,
    (_, n) => `5eed0000-0000-4000-8000-000000000${n === "MISSING" ? "999" : n}`,
  );

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
const results = [];

for (const row of rows) {
  const message = fill(row.message);
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: "user", content: message }],
    });
    const reply = res.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    results.push({ ...row, message, reply, stop: res.stop_reason });
    console.log(`#${row.id} done`);
  } catch (err) {
    results.push({
      ...row,
      message,
      reply: `ERROR: ${err.message}`,
      stop: "error",
    });
    console.log(`#${row.id} ERROR: ${err.message}`);
  }
}

const date = new Date().toISOString().slice(0, 10);
const out = [
  `# Layer 1 run: plain chatbot, no tools (${date})`,
  "",
  `Model: ${MODEL}`,
  `Max tokens: ${MAX_TOKENS}`,
  "Test set: evidence/test-set-2026-10-04.md",
  "System prompt: agents/layer1/system-prompt.txt plus agents/data/refund-policy.txt",
  "Tools: none. Order data in prompt: none. Run once, replies unedited.",
  "",
];
for (const r of results) {
  out.push(
    `## ${r.id}. ${r.category}`,
    "",
    `Message: ${r.message}`,
    "",
    "Reply:",
    "",
    ...r.reply.split("\n").map((l) => `> ${l}`),
    "",
    `Stop reason: ${r.stop}`,
    "Score: Correct ?, Invented ?, Escalation ?",
    "",
  );
}
const file = path.join(root, "evidence", `layer1-run-${date}.md`);
fs.writeFileSync(file, out.join("\n"));
console.log(`Saved ${file}`);
