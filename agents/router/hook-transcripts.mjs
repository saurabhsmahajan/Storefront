// Offline transcripts for each Step F hook. No model and no network: each step is a
// tool call the model could make, passed through the real hook functions.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clearState } from "../mcp/prerequisites.mjs";
import { buildHooks } from "./hooks.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const date = new Date().toISOString().slice(0, 10);
const ID = "5eed0000-0000-4000-8000-000000000103";
const blocks = (o) => [{ type: "text", text: JSON.stringify(o) }];
const session = "step-f-transcript";
clearState(session);

const approvals = new Set();
const hooks = buildHooks({ approvals });
const pre = hooks.PreToolUse[0].hooks[0];
const post = hooks.PostToolUse[0].hooks[0];
const out = [
  `# Week 3 step F: hook transcripts (${date})`,
  "",
  "Each step is a tool call passed through the real hook functions in agents/router/hooks.mjs (offline, no model). Tool results are fixtures shaped like the MCP server's output, with sensitive fields added where the redaction hook needs something to remove.",
  "",
];
const show = (o) => "```json\n" + JSON.stringify(o, null, 1) + "\n```";
async function call(label, tool, input, result) {
  const base = { session_id: session, tool_name: tool, tool_input: input };
  const p = await pre(base);
  const denied = p.hookSpecificOutput?.permissionDecision === "deny";
  out.push(
    `### ${label}`,
    "",
    `Model calls \`${tool}\` with ${JSON.stringify(input)}`,
    "",
  );
  out.push(
    `PreToolUse: **${denied ? "DENIED" : "allowed"}**` +
      (denied
        ? `. Reason shown to the model: ${p.hookSpecificOutput.permissionDecisionReason}`
        : ""),
    "",
  );
  if (denied || !result) return;
  const q = await post({ ...base, tool_response: blocks(result) });
  const seen = q.hookSpecificOutput?.updatedMCPToolOutput ?? blocks(result);
  out.push(
    "Raw tool result:",
    "",
    show(result),
    "",
    `PostToolUse: ${q.hookSpecificOutput ? "**result rewritten**" : "result passed through"}. What the model sees:`,
    "",
    show(JSON.parse(seen[0].text)),
    "",
  );
}
const T = (n) => `mcp__storefront__${n}`;

out.push("## Hook 1: tool ordering", "");
await call(
  "1a. Eligibility before any order lookup",
  T("check_refund_eligibility"),
  { order_id: ID },
);
await call(
  "1b. Order lookup first",
  T("get_order"),
  { order_id: ID },
  { order_id: ID, status: "paid", age_days: 12 },
);
await call(
  "1c. Eligibility now allowed",
  T("check_refund_eligibility"),
  { order_id: ID },
  { verdict: "eligible", reason: "within_window" },
);

out.push("## Hook 2: human approval for execute_refund (stub)", "");
const R = "mcp__refunds__execute_refund";
await call("2a. Model tries to refund with no approval", R, { order_id: ID });
await call("2b. Model adds its own approval flag", R, {
  order_id: ID,
  human_approved: true,
});
approvals.add(ID);
out.push(
  "_A human agent records approval for this order in the host application (outside the model)._",
  "",
);
await call(
  "2c. Same call after human approval",
  R,
  { order_id: ID },
  { stub: true, order_id: ID, status: "refund_recorded_not_executed" },
);

out.push("## Hook 3: result redaction", "");
await call(
  "3a. Payment result containing fields the model must not hold",
  T("get_payment_status"),
  { order_id: ID },
  {
    attempts: [
      {
        result: "refused",
        customer_reason: "Your bank declined the payment.",
        refusal_reason: "FRAUD",
        authorisation_code: "A1B2C3",
        card_last_four: "4242",
        expiry_date: "03/30",
      },
    ],
  },
);
out.push(
  "Limit: redaction works on named JSON fields. A secret inside free text, or under a field name not on the list, would pass through. The MCP server also never returns these fields, so the hook is a second layer.",
  "",
);
clearState(session);
const file = path.join(root, "evidence", `week-3-hook-transcripts-${date}.md`);
fs.writeFileSync(file, out.join("\n"));
console.log("Saved", file);
