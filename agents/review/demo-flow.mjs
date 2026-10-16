// Evidence for step G: a package opens, the stub call is blocked, the reviewer confirms,
// the PreToolUse hook allows the stub once, then blocks it again.
// Uses the real staff source when REVIEWER_EMAIL is set, otherwise a labelled fixture.
// Usage: node agents/review/demo-flow.mjs [path-to-package.json]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApprovalStore } from "./approvals.mjs";
import { buildView, confirmApproval } from "./review-core.mjs";
import { INBOX } from "./server.mjs";
import { staffSource } from "./staff-data.mjs";
import { buildHooks } from "../router/hooks.mjs";
import { clearState, saveState } from "../mcp/prerequisites.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const file =
  process.argv[2] ??
  path.join(
    INBOX,
    fs.readdirSync(INBOX).find((n) => n.includes("refund_recommendation")) ??
      "none.json",
  );
const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
const live = Boolean(process.env.REVIEWER_EMAIL);
const source = live
  ? await staffSource()
  : {
      reviewerEmail: "fixture-reviewer@storefront.test",
      getOrder: async (id) => ({ id, status: "paid", note: "FIXTURE" }),
      getEvents: async () => [
        { event_type: "AUTHORISATION", payload: { note: "FIXTURE" } },
      ],
    };
const store = createApprovalStore({
  file: path.join(os.tmpdir(), `demo-approvals-${Date.now()}.json`),
});
const hooks = buildHooks({ approvals: store });
const pre = hooks.PreToolUse[0].hooks[0];
const post = hooks.PostToolUse[0].hooks[0];
const session = "step-g-demo";
clearState(session);
saveState(session, { check_refund_eligibility: [pkg.order_id] });
const call = {
  session_id: session,
  tool_name: "mcp__refunds__execute_refund",
  tool_input: { order_id: pkg.order_id },
  tool_use_id: "demo",
};
const verdict = async () => {
  const r = await pre(call);
  const d = r.hookSpecificOutput;
  return d ? `DENIED. ${d.permissionDecisionReason}` : "allowed";
};
const out = [
  `# Week 3 step G: confirmation flow (${new Date().toISOString().slice(0, 10)})`,
  "",
  `Data source: ${live ? `real, reviewer ${source.reviewerEmail}` : "FIXTURE (not the database). Re-run with REVIEWER_EMAIL set for the real record."}`,
  `Package: ${path.basename(file)}, trigger ${pkg.trigger}, order ${pkg.order_id}`,
  "",
];
out.push(
  "1. Stub `execute_refund` before any confirmation: " + (await verdict()),
  "",
);
const view = await buildView(pkg, source);
out.push(
  `2. Package opened. Can approve: ${view.canApprove}. Records digest ${view.digest.slice(0, 12)}. Payment events shown: ${view.events.length}.`,
  "",
);
const no = await confirmApproval({
  pkg,
  source,
  store,
  viewDigest: view.digest,
  acknowledged: false,
});
out.push(
  `3. Confirm without the tick: ${no.ok ? "approved (BUG)" : `refused (${no.code})`}`,
  "",
);
const stale = await confirmApproval({
  pkg,
  source,
  store,
  viewDigest: "0".repeat(64),
  acknowledged: true,
});
out.push(
  `4. Confirm with a digest that does not match the records: ${stale.ok ? "approved (BUG)" : `refused (${stale.code})`}`,
  "",
);
out.push("5. Stub call after the refusals: " + (await verdict()), "");
const ok = await confirmApproval({
  pkg,
  source,
  store,
  viewDigest: view.digest,
  acknowledged: true,
});
out.push(
  `6. Reviewer confirms with the tick and the real digest: ${ok.ok ? `approved by ${ok.approval.approved_by}, expires ${ok.approval.expires_at}` : `refused (${ok.code})`}`,
  "",
);
out.push("7. Stub call after confirmation: " + (await verdict()), "");
await post({
  ...call,
  tool_response: [
    {
      type: "text",
      text: JSON.stringify({
        stub: true,
        order_id: pkg.order_id,
        status: "refund_recorded_not_executed",
      }),
    },
  ],
});
out.push(
  "8. Stub ran (no money moved). Approval is spent. Stub call again: " +
    (await verdict()),
  "",
);
out.push(
  "Approval record:",
  "",
  "```json",
  JSON.stringify(store.list(), null, 1),
  "```",
  "",
);
clearState(session);
const dest = path.join(
  root,
  "evidence",
  `week-3-confirmation-flow-${live ? "live" : "fixture"}-${new Date().toISOString().slice(0, 10)}.md`,
);
fs.writeFileSync(dest, out.join("\n"));
console.log(out.join("\n"));
console.log("Saved", dest);
