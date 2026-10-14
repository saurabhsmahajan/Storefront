import test from "node:test";
import assert from "node:assert/strict";
import {
  bareName,
  checkPrerequisites,
  clearState,
  loadState,
  recordSuccess,
  resultSucceeded,
  saveState,
} from "./prerequisites.mjs";

const A = "5eed0000-0000-4000-8000-000000000101";
const B = "5eed0000-0000-4000-8000-000000000102";
const ok = (o) => [{ type: "text", text: JSON.stringify(o) }];

test("bareName strips the server prefix", () => {
  assert.equal(bareName("mcp__storefront__get_order"), "get_order");
  assert.equal(bareName("get_order"), "get_order");
});

test("refund check is blocked before any order lookup", () => {
  const v = checkPrerequisites(
    "mcp__storefront__check_refund_eligibility",
    { order_id: A },
    {},
  );
  assert.equal(v.allow, false);
  assert.match(v.reason, /get_order/);
});

test("refund check is allowed after get_order succeeded for the same order", () => {
  const s = recordSuccess(
    "mcp__storefront__get_order",
    { order_id: A },
    true,
    {},
  );
  assert.equal(
    checkPrerequisites("check_refund_eligibility", { order_id: A }, s).allow,
    true,
  );
});

test("a lookup of a different order does not unlock this one", () => {
  const s = recordSuccess("get_order", { order_id: B }, true, {});
  assert.equal(
    checkPrerequisites("check_refund_eligibility", { order_id: A }, s).allow,
    false,
  );
});

test("a failed lookup does not count", () => {
  const s = recordSuccess("get_order", { order_id: A }, false, {});
  assert.equal(
    checkPrerequisites("check_refund_eligibility", { order_id: A }, s).allow,
    false,
  );
});

test("order id case does not matter", () => {
  const s = recordSuccess("get_order", { order_id: A.toUpperCase() }, true, {});
  assert.equal(
    checkPrerequisites("check_refund_eligibility", { order_id: A }, s).allow,
    true,
  );
});

test("fails closed on a missing or malformed order id", () => {
  for (const input of [undefined, {}, { order_id: "101" }, { order_id: 5 }]) {
    assert.equal(
      checkPrerequisites("check_refund_eligibility", input, { get_order: [A] })
        .allow,
      false,
    );
  }
});

test("tools without a prerequisite are not affected", () => {
  for (const t of ["get_order", "get_payment_status", "something_else"]) {
    assert.equal(checkPrerequisites(t, { order_id: A }, {}).allow, true);
  }
});

test("recording does not mutate the old state and does not duplicate", () => {
  const s0 = {};
  const s1 = recordSuccess("get_order", { order_id: A }, true, s0);
  assert.deepEqual(s0, {});
  assert.deepEqual(recordSuccess("get_order", { order_id: A }, true, s1), s1);
});

test("resultSucceeded: success, structured error, malformed, wrong shape", () => {
  assert.equal(resultSucceeded(ok({ status: "paid" })), true);
  assert.equal(resultSucceeded(ok({ error: { type: "not_found" } })), false);
  assert.equal(resultSucceeded([{ type: "text", text: "not json" }]), false);
  assert.equal(resultSucceeded(undefined), false);
  assert.equal(resultSucceeded("paid"), false);
  assert.equal(
    resultSucceeded({ content: ok({ status: "paid" }), isError: true }),
    false,
  );
  assert.equal(resultSucceeded({ content: ok({ status: "paid" }) }), true);
});

test("state is kept per session", () => {
  const s1 = `test-${process.pid}-1`,
    s2 = `test-${process.pid}-2`;
  saveState(s1, { get_order: [A] });
  assert.deepEqual(loadState(s1), { get_order: [A] });
  assert.deepEqual(loadState(s2), {});
  clearState(s1);
  assert.deepEqual(loadState(s1), {});
});
