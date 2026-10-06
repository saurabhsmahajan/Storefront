import test from "node:test";
import assert from "node:assert/strict";
import { decideEligibility } from "./refund-rules.mjs";

const NOW = Date.parse("2026-10-06T12:00:00Z");
const order = (status, days) => ({
  status,
  total_minor: 159900,
  currency: "INR",
  created_at: new Date(NOW - days * 86400000).toISOString(),
});
const ev = (event_type, success = "true") => ({
  event_type,
  payload: { success },
});
const AUTH_CAP = [ev("AUTHORISATION"), ev("CAPTURE")];
const run = (o, events = []) =>
  decideEligibility({ order: o, events, now: NOW });

test("missing order", () => {
  assert.equal(run(null).verdict, "not_found");
});
test("already refunded", () => {
  const r = run(order("refunded", 20), [...AUTH_CAP, ev("REFUND")]);
  assert.deepEqual([r.verdict, r.reason], ["not_eligible", "already_refunded"]);
});
test("pending, never paid", () => {
  const r = run(order("pending", 2), [ev("AUTHORISATION", "false")]);
  assert.deepEqual([r.verdict, r.reason], ["not_eligible", "never_paid"]);
});
test("pending but captured: customer was charged", () => {
  const r = run(order("pending", 2), AUTH_CAP);
  assert.deepEqual([r.verdict, r.reason], ["no_rule", "pending_with_capture"]);
});
test("paid, captured, 3 days: eligible", () => {
  const r = run(order("paid", 3), AUTH_CAP);
  assert.deepEqual([r.verdict, r.reason], ["eligible", "within_window"]);
  assert.equal(r.facts.total, "1599.00 INR");
});
test("paid, captured, exactly 30 days: eligible", () => {
  assert.equal(run(order("paid", 30), AUTH_CAP).verdict, "eligible");
});
test("paid, captured, 31 days: outside the window", () => {
  const r = run(order("paid", 31), AUTH_CAP);
  assert.deepEqual([r.verdict, r.reason], ["not_eligible", "outside_window"]);
});
test("paid without a capture event", () => {
  const r = run(order("paid", 3), [ev("AUTHORISATION")]);
  assert.deepEqual([r.verdict, r.reason], ["no_rule", "paid_without_capture"]);
});
test("paid but a refund is already recorded", () => {
  const r = run(order("paid", 3), [...AUTH_CAP, ev("REFUND")]);
  assert.deepEqual([r.verdict, r.reason], ["no_rule", "inconsistent_records"]);
});
test("cancelled: the policy has no rule", () => {
  const r = run(order("cancelled", 11), [
    ev("AUTHORISATION"),
    ev("CANCELLATION"),
  ]);
  assert.deepEqual([r.verdict, r.reason], ["no_rule", "cancelled_order"]);
});
test("unknown status: the policy has no rule", () => {
  const r = run(order("fulfilled", 5), AUTH_CAP);
  assert.deepEqual([r.verdict, r.reason], ["no_rule", "status_not_covered"]);
});
