// Live 21-message run of the Step F agent. Same test set and output shape as the Week 2
// runs, so the replies can be scored by hand the same way. Run on your own machine.
// Env: ANTHROPIC_API_KEY, STOREFRONT_MCP_URL, STOREFRONT_CUSTOMER_JWT
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODEL } from "../config.mjs";
import { loadTestSet } from "../lib/testset.mjs";
import { runSdkRouter } from "./sdk-router.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const rows = loadTestSet();
const date = new Date().toISOString().slice(0, 10);
const out = [
  `# Step F: Agent SDK agent with MCP tools and hooks, 21-message run (${date})`,
  "",
  `Model: ${MODEL}`,
  "Test set: evidence/test-set-2026-10-04.md. Score #7 to #10 against the revised expectations in evidence/decline-disclosure-decision-2026-10-06.md, as in Week 2.",
  "Setup: Agent SDK query(), storefront MCP server over HTTP with the customer token, stub execute_refund, hooks for ordering, human approval and redaction. Run once, replies unedited.",
  "",
];
for (const row of rows) {
  let r;
  try {
    r = await runSdkRouter(row.message);
  } catch (e) {
    r = {
      reply: `ERROR: ${e.message}`,
      toolCalls: [],
      hookLog: [],
      turns: 0,
      ms: 0,
    };
  }
  const denied = r.hookLog.filter((h) => h.allow === false);
  const redacted = r.hookLog.filter((h) => h.redactions?.length);
  out.push(
    `## ${row.id}. ${row.category}`,
    "",
    `Message: ${row.message}`,
    "",
    `Trace: turns=${r.turns}, tools=${r.toolCalls.map((t) => t.name.replace("mcp__", "")).join(", ") || "none"}, denied=${denied.length}, redacted=${redacted.length}, ms=${r.ms}`,
    "",
    "Hook log:",
    "",
    "```json",
    JSON.stringify(r.hookLog, null, 1).slice(0, 3000),
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
  console.log(`#${row.id} turns=${r.turns} denied=${denied.length} ${r.ms}ms`);
}
const file = path.join(root, "evidence", `week-3-sdk-agent-run-${date}.md`);
fs.writeFileSync(file, out.join("\n"));
console.log("Saved", file);
