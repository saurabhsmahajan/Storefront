import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { createApprovalStore, sha256 } from "./approvals.mjs";
import { buildView, confirmApproval } from "./review-core.mjs";
import { esc, renderReview } from "./page.mjs";
import { createServer } from "./server.mjs";
import { buildHandoff } from "../lib/handoff.mjs";
import { buildHooks, decideToolCall } from "../router/hooks.mjs";
import { clearState, saveState } from "../mcp/prerequisites.mjs";

const ID = "5eed0000-0000-4000-8000-000000000103";
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "review-"));
const pkgFor = (over = {}) =>
  JSON.parse(
    JSON.stringify(
      buildHandoff({
        from: "system",
        to: "human",
        trigger: "refund_recommendation",
        customerMessage: `Refund ${ID}`,
        orderId: ID,
        findings: [
          { source: "mcp:check_refund_eligibility", verdict: "eligible" },
        ],
        recommendation: "Full refund. A human decides.",
        agentNote: "Model words <script>alert(1)</script>",
        ...over,
      }),
    ),
  );
let rows = {
  order: { id: ID, status: "paid", total_minor: 159900 },
  events: [
    {
      event_type: "AUTHORISATION",
      received_at: "t",
      payload: { success: "true", note: "<img src=x onerror=1>" },
    },
  ],
};
const source = () => ({
  reviewerEmail: "reviewer@storefront.test",
  getOrder: async () => rows.order,
  getEvents: async () => rows.events,
});
const store = (over = {}) =>
  createApprovalStore({ file: path.join(tmp(), "a.json"), ...over });

test("digest is the same for the same data and changes when a record changes", async () => {
  const a = await buildView(pkgFor(), source());
  const b = await buildView(
    pkgFor({ now: new Date(a.pkg.created_at) }),
    source(),
  );
  assert.equal(a.digest, b.digest);
  assert.notEqual(sha256({ x: 1, y: 2 }), sha256({ x: 1, y: 3 }));
  assert.equal(sha256({ a: 1, b: 2 }), sha256({ b: 2, a: 1 }));
});

test("confirm: needs the tick, a matching digest and an approvable package", async () => {
  const s = store();
  const pkg = pkgFor();
  const view = await buildView(pkg, source());
  assert.equal(
    (
      await confirmApproval({
        pkg,
        source: source(),
        store: s,
        viewDigest: view.digest,
        acknowledged: false,
      })
    ).code,
    "not_acknowledged",
  );
  assert.equal(
    (
      await confirmApproval({
        pkg,
        source: source(),
        store: s,
        viewDigest: "wrong",
        acknowledged: true,
      })
    ).code,
    "stale",
  );
  assert.equal(s.has(ID), false);
  const ok = await confirmApproval({
    pkg,
    source: source(),
    store: s,
    viewDigest: view.digest,
    acknowledged: true,
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.approval.approved_by, "reviewer@storefront.test");
  assert.equal(s.has(ID), true);
});

test("confirm: records changed after the page loaded means no approval", async () => {
  const s = store();
  const pkg = pkgFor();
  const view = await buildView(pkg, source());
  const before = rows;
  rows = { ...rows, order: { ...rows.order, status: "refunded" } };
  const r = await confirmApproval({
    pkg,
    source: source(),
    store: s,
    viewDigest: view.digest,
    acknowledged: true,
  });
  rows = before;
  assert.equal(r.code, "stale");
  assert.equal(s.has(ID), false);
});

test("confirm: policy gap, missing order and invalid package cannot be approved", async () => {
  const s = store();
  const gap = pkgFor({ trigger: "policy_gap" });
  const v = await buildView(gap, source());
  assert.equal(v.canApprove, false);
  assert.equal(
    (
      await confirmApproval({
        pkg: gap,
        source: source(),
        store: s,
        viewDigest: v.digest,
        acknowledged: true,
      })
    ).code,
    "not_approvable",
  );
  const none = { ...source(), getOrder: async () => null };
  const v2 = await buildView(pkgFor(), none);
  assert.equal(v2.canApprove, false);
  const bad = {
    ...pkgFor(),
    authorization: { refund_approved: true, approved_by: "x", note: "" },
  };
  assert.equal((await buildView(bad, source())).ok, false);
  assert.equal(s.list().length, 0);
});

test("approval expires and is single-use", async () => {
  let t = new Date("2026-10-16T10:00:00Z");
  const s = store({ now: () => t, ttlMs: 60_000 });
  s.add({ orderId: ID, approvedBy: "r", packageSha256: "p", viewDigest: "d" });
  assert.equal(s.has(ID), true);
  assert.equal(s.consume(ID), true);
  assert.equal(s.has(ID), false);
  assert.equal(s.consume(ID), false);
  s.add({ orderId: ID, approvedBy: "r", packageSha256: "p", viewDigest: "d" });
  t = new Date("2026-10-16T10:02:00Z");
  assert.equal(s.has(ID), false);
});

test("page: untrusted text is escaped, model text is labelled", async () => {
  const view = await buildView(pkgFor(), source());
  const html = renderReview({ view, name: "m.json", token: "t" });
  assert.equal(html.includes("<script>alert(1)</script>"), false);
  assert.equal(html.includes("<img src=x"), false);
  assert.match(html, /model text, unverified/);
  assert.match(html, /Raw records/);
  assert.match(html, /disabled/);
  assert.equal(esc(`<>"'&`), "&lt;&gt;&quot;&#39;&amp;");
});

test("page: no approve button when the package cannot be approved", async () => {
  const view = await buildView(pkgFor({ trigger: "policy_gap" }), source());
  const html = renderReview({ view, name: "m.json", token: "t" });
  assert.equal(html.includes("Approve refund"), false);
  assert.match(html, /cannot be approved on this screen/);
});

test("end to end with the hook: denied, approved at the screen, allowed once, then denied again", async () => {
  const session = "review-e2e";
  clearState(session);
  saveState(session, { check_refund_eligibility: [ID] });
  const s = store();
  const hooks = buildHooks({ approvals: s });
  const pre = hooks.PreToolUse[0].hooks[0];
  const post = hooks.PostToolUse[0].hooks[0];
  const call = {
    session_id: session,
    tool_name: "mcp__refunds__execute_refund",
    tool_input: { order_id: ID },
    tool_use_id: "x",
  };
  assert.equal((await pre(call)).hookSpecificOutput.permissionDecision, "deny");
  const pkg = pkgFor();
  const view = await buildView(pkg, source());
  assert.equal(
    (
      await confirmApproval({
        pkg,
        source: source(),
        store: s,
        viewDigest: view.digest,
        acknowledged: true,
      })
    ).ok,
    true,
  );
  assert.deepEqual(await pre(call), {});
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
  assert.equal((await pre(call)).hookSpecificOutput.permissionDecision, "deny");
  clearState(session);
});

test("server: approve over HTTP needs the token, the tick and a matching digest", async () => {
  const dir = tmp();
  const inbox = path.join(dir, "inbox");
  fs.mkdirSync(inbox);
  fs.writeFileSync(path.join(inbox, "m.json"), JSON.stringify(pkgFor()));
  const s = createApprovalStore({ file: path.join(dir, "a.json") });
  const server = createServer({
    source: source(),
    store: s,
    inbox,
    token: "tok",
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const req = (method, p, body, headers = {}) =>
    new Promise((resolve, reject) => {
      const r = http.request(
        {
          host: "127.0.0.1",
          port,
          method,
          path: p,
          headers: { host: "127.0.0.1", ...headers },
        },
        (res) => {
          let d = "";
          res.on("data", (c) => (d += c));
          res.on("end", () => resolve({ code: res.statusCode, text: d }));
        },
      );
      r.on("error", reject);
      r.end(body);
    });
  try {
    assert.match((await req("GET", "/")).text, /m\.json/);
    const page = await req("GET", "/p/m.json");
    assert.equal(page.code, 200);
    const digest = page.text.match(/name="digest" value="([0-9a-f]+)"/)[1];
    const post = (fields) =>
      req("POST", "/p/m.json/confirm", new URLSearchParams(fields).toString(), {
        "content-type": "application/x-www-form-urlencoded",
      });
    assert.equal((await post({ token: "bad", digest, ack: "yes" })).code, 403);
    assert.equal((await post({ token: "tok", digest, ack: "no" })).code, 400);
    assert.equal(
      (await post({ token: "tok", digest: "x", ack: "yes" })).code,
      409,
    );
    assert.equal(s.has(ID), false);
    const ok = await post({ token: "tok", digest, ack: "yes" });
    assert.equal(ok.code, 200);
    assert.match(ok.text, /Approved/);
    assert.equal(s.has(ID), true);
    assert.equal((await req("GET", "/p/..%2Fa.json")).code, 404);
    assert.equal(
      (await req("GET", "/", undefined, { host: "evil.example" })).code,
      403,
    );
  } finally {
    server.close();
  }
});
