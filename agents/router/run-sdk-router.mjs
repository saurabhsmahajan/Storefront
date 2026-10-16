// Live 21-message run of the Step F agent. Same test set and output shape as the Week 2
// runs, so the replies can be scored by hand the same way. Run on your own machine.
// Env: ANTHROPIC_API_KEY, STOREFRONT_MCP_URL, STOREFRONT_CUSTOMER_JWT
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODEL } from "../config.mjs";
import { loadTestSet } from "../lib/testset.mjs";
import { handleWithHandoff } from "./handoff-agent.mjs";
import { createApprovalStore } from "../review/approvals.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const rows = loadTestSet();
const inbox = path.join(root, "agents", "review", "inbox");
const store = createApprovalStore({
  file: path.join(root, "agents", "review", "approvals.json"),
});
const date = new Date().toISOString().slice(0, 10);
const out = [
  `# Step F follow-up: Agent SDK agent with hooks and code-owned handoff, 21-message run (${date})`,
  "",
  `Model: ${MODEL}`,
  "Test set: evidence/test-set-2026-10-04.md. Score #7 to #10 against the revised expectations in evidence/decline-disclosure-decision-2026-10-06.md, as in Week 2.",
  "Setup: Agent SDK query(), storefront MCP server over HTTP with the customer token, stub execute_refund, hooks for ordering, human approval and redaction. Run once, replies unedited.",
  "",
];
for (const row of rows) {
  let r;
  try {
    r = await handleWithHandoff(row.message, {
      agentOptions: { approvals: store },
    });
  } catch (e) {
    r = {
      reply: `ERROR: ${e.message}`,
      toolCalls: [],
      hookLog: [],
      outcome: "crashed",
      escalation: null,
      handoff: null,
      ms: 0,
    };
  }
  const denied = r.hookLog.filter((h) => h.allow === false);
  const redacted = r.hookLog.filter((h) => h.redactions?.length);
  if (r.handoff) {
    fs.mkdirSync(inbox, { recursive: true });
    fs.writeFileSync(
      path.join(
        inbox,
        `message-${String(row.id).padStart(2, "0")}-${r.handoff.trigger}.json`,
      ),
      JSON.stringify(r.handoff, null, 1),
    );
  }
  out.push(
    `## ${row.id}. ${row.category}`,
    "",
    `Message: ${row.message}`,
    "",
    `Trace: route=${r.route}, outcome=${r.outcome}, escalation=${JSON.stringify(r.escalation)}, tools=${r.toolCalls.map((t) => t.name.replace("mcp__", "")).join(", ") || "none"}, denied=${denied.length}, redacted=${redacted.length}, ms=${r.ms}`,
    "",
    "Hook log:",
    "",
    "```json",
    JSON.stringify(r.hookLog, null, 1).slice(0, 3000),
    "```",
    "",
    "Handoff package:",
    "",
    "```json",
    JSON.stringify(r.handoff ?? null, null, 1).slice(0, 3000),
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
    `#${row.id} ${r.outcome} ${r.escalation?.trigger ?? "-"} denied=${denied.length} ${r.ms}ms`,
  );
}
const file = path.join(root, "evidence", `week-3-sdk-agent-run-v2-${date}.md`);
fs.writeFileSync(file, out.join("\n"));
console.log("Saved", file);
