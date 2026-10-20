// Evidence for step G, third moment: after a human approved on the review screen,
// the PreToolUse hook allows the stub execute_refund call once, then denies it again.
// Reads the REAL approval file written by the review server. Uses a separate session id,
// and sets the "eligibility check succeeded" state itself (the ordering rule is proven
// elsewhere), so this script proves the approval step only.
// Usage: node agents/review/hook-after-approval.mjs message-11-refund_recommendation.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApprovalStore } from "./approvals.mjs";
import { APPROVALS_FILE, INBOX } from "./server.mjs";
import { buildHooks } from "../router/hooks.mjs";
import { clearState, saveState } from "../mcp/prerequisites.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const name = process.argv[2];
if (!name) throw new Error("Pass the package file name from the inbox.");
const pkg = JSON.parse(fs.readFileSync(path.join(INBOX, name), "utf8"));
const id = String(pkg.order_id).toLowerCase();
const store = createApprovalStore({
  file: process.env.APPROVALS_FILE ?? APPROVALS_FILE,
});
const lines = [];
const say = (s) => {
  lines.push(s);
  console.log(s);
};

const session = "hook-after-approval";
clearState(session);
saveState(session, { check_refund_eligibility: [id] });
const hooks = buildHooks({ approvals: store });
const pre = hooks.PreToolUse[0].hooks[0];
const post = hooks.PostToolUse[0].hooks[0];
const call = {
  session_id: session,
  tool_name: "mcp__refunds__execute_refund",
  tool_input: { order_id: id },
  tool_use_id: "after-approval",
};
const decision = async () =>
  (await pre(call)).hookSpecificOutput?.permissionDecision === "deny"
    ? "DENY"
    : "ALLOW";

say(`Package: ${name}   order: ${id}`);
const rec = store.list().findLast((a) => a.order_id === id);
say(
  rec
    ? `Approval on file: by ${rec.approved_by}, until ${rec.expires_at}, consumed=${rec.consumed}`
    : "No approval on file for this order.",
);
say(`Hook decision before use, with the approval: ${await decision()}`);
await post({
  ...call,
  tool_response: [
    {
      type: "text",
      text: JSON.stringify({
        stub: true,
        status: "refund_recorded_not_executed",
      }),
    },
  ],
});
say("The stub ran once (it records, it does not refund).");
say(`Hook decision after use: ${await decision()}`);
clearState(session);

const out = path.join(
  root,
  "evidence",
  `week-3-hook-after-approval-${new Date().toISOString().slice(0, 10)}.md`,
);
fs.writeFileSync(
  out,
  `# Week 3 step G: the hook after a real approval\n\nThe approval was created by clicking Approve on the live review screen. This script reads the approval file the screen wrote, then asks the PreToolUse hook about the stub execute_refund call. The "eligibility check succeeded" state is set by the script; the ordering rule is proven separately.\n\n\`\`\`\n${lines.join("\n")}\n\`\`\`\n`,
);
console.log(`\nWrote ${out}`);
