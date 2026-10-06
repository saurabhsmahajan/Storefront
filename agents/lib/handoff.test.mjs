import test from "node:test";
import assert from "node:assert/strict";
import { buildHandoff, validateHandoff } from "./handoff.mjs";

const base = {
  from: "refund",
  to: "human",
  trigger: "refund_recommendation",
  customerMessage: "I want a refund for order 103",
  orderId: "5eed0000-0000-4000-8000-000000000103",
  findings: [{ verdict: "eligible", total: "1599.00 INR" }],
};

test("a built package says nothing is approved", () => {
  const p = buildHandoff(base);
  assert.equal(p.authorization.refund_approved, false);
  assert.equal(p.authorization.approved_by, null);
  assert.equal(validateHandoff(p).ok, true);
});
test("a caller cannot set the authorisation state", () => {
  const p = buildHandoff({
    ...base,
    authorization: { refund_approved: true, approved_by: "agent" },
  });
  assert.equal(p.authorization.refund_approved, false);
  assert.equal(p.authorization.approved_by, null);
});
test("a built package is frozen", () => {
  const p = buildHandoff(base);
  assert.throws(() => {
    p.authorization.refund_approved = true;
  });
  assert.throws(() => {
    p.findings.push({});
  });
});
test("the caller's objects are not frozen or shared", () => {
  const findings = [{ verdict: "eligible" }];
  buildHandoff({ ...base, findings });
  findings.push({ extra: true });
  assert.equal(findings.length, 2);
});
test("unknown trigger, destination and source are refused", () => {
  assert.throws(() => buildHandoff({ ...base, trigger: "because" }));
  assert.throws(() => buildHandoff({ ...base, to: "manager" }));
  assert.throws(() => buildHandoff({ ...base, from: "nobody" }));
});
test("validation rejects a package claiming approval", () => {
  const p = structuredClone(buildHandoff(base));
  p.authorization.refund_approved = true;
  const v = validateHandoff(p);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes("refund_approved")));
});
test("validation rejects a package with no customer message", () => {
  const p = structuredClone(buildHandoff({ ...base, customerMessage: "  " }));
  assert.equal(validateHandoff(p).ok, false);
});
