import test from "node:test";
import assert from "node:assert/strict";
import { clearState } from "../mcp/prerequisites.mjs";
import {
  REDACTED,
  toolResultsFromLog,
  buildHooks,
  decideToolCall,
  redactToolResponse,
  redactValue,
} from "./hooks.mjs";

const ID = "5eed0000-0000-4000-8000-000000000103";
const text = (obj) => [{ type: "text", text: JSON.stringify(obj) }];

test("approval: execute_refund is denied without a human approval", () => {
  const v = decideToolCall(
    "mcp__refunds__execute_refund",
    { order_id: ID },
    { get_order: [ID], check_refund_eligibility: [ID] },
    new Set(),
  );
  assert.equal(v.allow, false);
  assert.match(v.reason, /human agent/);
});

test("approval: a flag in the model's own input does not count", () => {
  const v = decideToolCall(
    "mcp__refunds__execute_refund",
    { order_id: ID, human_approved: true, approved: true },
    { check_refund_eligibility: [ID] },
    new Set(),
  );
  assert.equal(v.allow, false);
});

test("approval: allowed only with host approval and a prior eligibility check", () => {
  const approvals = new Set([ID]);
  assert.equal(
    decideToolCall("execute_refund", { order_id: ID }, {}, approvals).allow,
    false,
  );
  assert.equal(
    decideToolCall(
      "execute_refund",
      { order_id: ID },
      { check_refund_eligibility: [ID] },
      approvals,
    ).allow,
    true,
  );
});

test("approval: approval for one order does not cover another", () => {
  const other = "5eed0000-0000-4000-8000-000000000104";
  const v = decideToolCall(
    "execute_refund",
    { order_id: other },
    { check_refund_eligibility: [other] },
    new Set([ID]),
  );
  assert.equal(v.allow, false);
});

test("approval: missing or short order id fails closed", () => {
  for (const input of [{}, { order_id: "103" }, null])
    assert.equal(
      decideToolCall("execute_refund", input, {}, new Set([ID])).allow,
      false,
    );
});

test("ordering is still enforced through the combined decision", () => {
  assert.equal(
    decideToolCall(
      "mcp__storefront__check_refund_eligibility",
      { order_id: ID },
      {},
      new Set(),
    ).allow,
    false,
  );
  assert.equal(
    decideToolCall(
      "mcp__storefront__check_refund_eligibility",
      { order_id: ID },
      { get_order: [ID] },
      new Set(),
    ).allow,
    true,
  );
});

test("redaction: sensitive keys replaced at any depth, others kept", () => {
  const { value, redactions } = redactValue({
    order_id: ID,
    attempts: [
      { result: "refused", refusalReason: "FRAUD", authCode: "123456" },
      { result: "authorised", card_last_four: "4242", expiry_date: "03/30" },
    ],
  });
  assert.equal(value.order_id, ID);
  assert.equal(value.attempts[0].result, "refused");
  assert.equal(value.attempts[0].refusalReason, REDACTED);
  assert.equal(value.attempts[0].authCode, REDACTED);
  assert.equal(value.attempts[1].card_last_four, REDACTED);
  assert.equal(value.attempts[1].expiry_date, REDACTED);
  assert.equal(redactions.length, 4);
});

test("redaction: works on MCP content blocks and keeps shape", () => {
  const { response, redactions } = redactToolResponse(
    text({ status: "paid", authorisation_code: "ABC123" }),
  );
  assert.equal(Array.isArray(response), true);
  assert.equal(JSON.parse(response[0].text).authorisation_code, REDACTED);
  assert.equal(JSON.parse(response[0].text).status, "paid");
  assert.deepEqual(redactions, ["authorisation_code"]);
  const wrapped = redactToolResponse({ content: text({ last4: "1111" }) });
  assert.equal(JSON.parse(wrapped.response.content[0].text).last4, REDACTED);
});

test("redaction: clean results and non-JSON text pass through untouched", () => {
  const clean = text({ status: "paid" });
  assert.equal(redactToolResponse(clean).response, clean);
  const odd = [{ type: "text", text: "not json" }];
  assert.equal(redactToolResponse(odd).response, odd);
  assert.deepEqual(redactToolResponse(undefined).redactions, []);
});

test("SDK wiring: record on success, block before, redact after", async () => {
  const session = "step-f-test-session";
  clearState(session);
  const log = [];
  const hooks = buildHooks({ log: (e) => log.push(e) });
  const pre = hooks.PreToolUse[0].hooks[0];
  const post = hooks.PostToolUse[0].hooks[0];
  const base = { session_id: session, tool_input: { order_id: ID } };

  const blocked = await pre({
    ...base,
    tool_name: "mcp__storefront__check_refund_eligibility",
  });
  assert.equal(blocked.hookSpecificOutput.permissionDecision, "deny");

  const rec = await post({
    ...base,
    tool_name: "mcp__storefront__get_order",
    tool_response: text({ status: "paid" }),
  });
  assert.deepEqual(rec, {});

  const allowed = await pre({
    ...base,
    tool_name: "mcp__storefront__check_refund_eligibility",
  });
  assert.deepEqual(allowed, {});

  const red = await post({
    ...base,
    tool_name: "mcp__storefront__get_payment_status",
    tool_response: text({ attempts: [{ refusal_reason: "FRAUD" }] }),
  });
  const out = red.hookSpecificOutput.updatedMCPToolOutput;
  assert.equal(JSON.parse(out[0].text).attempts[0].refusal_reason, REDACTED);
  assert.equal(log.filter((e) => e.allow === false).length, 1);
  clearState(session);
});

test("hook log to tool results: successes carry the body, unfinished allowed calls count as errors", async () => {
  const session = "step-f-log-session";
  clearState(session);
  const log = [];
  const hooks = buildHooks({ log: (e) => log.push(e) });
  const pre = hooks.PreToolUse[0].hooks[0];
  const post = hooks.PostToolUse[0].hooks[0];
  const a = { session_id: session, tool_input: { order_id: ID } };
  await pre({
    ...a,
    tool_use_id: "t1",
    tool_name: "mcp__storefront__get_order",
  });
  await post({
    ...a,
    tool_use_id: "t1",
    tool_name: "mcp__storefront__get_order",
    tool_response: text({ status: "paid" }),
  });
  await pre({
    ...a,
    tool_use_id: "t2",
    tool_name: "mcp__storefront__get_order",
  });
  await pre({
    ...a,
    tool_use_id: "t3",
    tool_name: "mcp__storefront__check_refund_eligibility",
  });
  const results = toolResultsFromLog(log);
  assert.equal(results.length, 3);
  assert.deepEqual(results[0], {
    name: "mcp__storefront__get_order",
    isError: false,
    body: { status: "paid" },
  });
  assert.equal(results[1].isError, true);
  clearState(session);
});

test("redaction: the authCode:last4:expiry triple is caught under any field name", () => {
  const { value, redactions } = redactValue({
    events: [
      { eventCode: "AUTHORISATION", reason: "602715:1111:11/2028", note: "ok" },
    ],
    other: "see 12:30 tomorrow",
  });
  assert.equal(value.events[0].reason, REDACTED);
  assert.equal(value.events[0].note, "ok");
  assert.equal(value.other, "see 12:30 tomorrow");
  assert.deepEqual(redactions, ["events[0].reason"]);
});
