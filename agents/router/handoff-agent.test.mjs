import test from "node:test";
import assert from "node:assert/strict";
import { validateHandoff } from "../lib/handoff.mjs";
import { handleWithHandoff } from "./handoff-agent.mjs";

const ID = "5eed0000-0000-4000-8000-000000000103";
const cls = (intent) => async () => ({ intent });
const ok = (name, body) => ({
  name: `mcp__storefront__${name}`,
  isError: false,
  body,
});
const agent =
  (over = {}) =>
  async () => ({
    reply: "Model words.",
    toolCalls: [],
    toolResults: [],
    hookLog: [],
    forcedReason: null,
    ...over,
  });
const never = async () => {
  throw new Error("agent must not run");
};

test("R1: a human request escalates by code and the agent never runs", async () => {
  const r = await handleWithHandoff(`Get me a real person about ${ID}`, {
    classify: cls("human_request"),
    runAgent: never,
  });
  assert.equal(r.outcome, "escalated");
  assert.equal(r.escalation.trigger, "explicit_human_request");
  assert.equal(r.handoff.order_id, ID);
  assert.equal(r.handoff.findings.length, 0);
  assert.equal(validateHandoff(r.handoff).ok, true);
  assert.equal(r.toolCalls.length, 0);
});

test("router failure escalates, agent does not run", async () => {
  const r = await handleWithHandoff("hi", {
    classify: async () => {
      throw new Error("down");
    },
    runAgent: never,
  });
  assert.equal(r.escalation.trigger, "api_error");
});

test("eligible refund escalates with verified findings and the code-written line", async () => {
  const body = { order_id: ID, verdict: "eligible", reason: "within_window" };
  const r = await handleWithHandoff(`Refund ${ID}`, {
    classify: cls("refund"),
    runAgent: agent({
      toolResults: [
        ok("get_order", { status: "paid" }),
        ok("check_refund_eligibility", body),
      ],
    }),
  });
  assert.equal(r.escalation.trigger, "refund_recommendation");
  assert.match(r.reply, /Model words\./);
  assert.match(r.reply, /A human agent decides every refund/);
  assert.deepEqual(
    r.handoff.findings.map((f) => f.source),
    ["mcp:get_order", "mcp:check_refund_eligibility"],
  );
  assert.equal(r.handoff.agent_note, "Model words.");
  assert.equal(r.handoff.authorization.refund_approved, false);
});

test("policy gap escalates", async () => {
  const r = await handleWithHandoff(`cancelled ${ID}`, {
    classify: cls("refund"),
    runAgent: agent({
      toolResults: [
        ok("check_refund_eligibility", {
          verdict: "no_rule",
          reason: "cancelled_order",
        }),
      ],
    }),
  });
  assert.equal(r.escalation.trigger, "policy_gap");
});

test("not_eligible refund and plain lookups do not escalate", async () => {
  for (const results of [
    [ok("check_refund_eligibility", { verdict: "not_eligible" })],
    [ok("get_order", { status: "paid" })],
    [],
  ]) {
    const r = await handleWithHandoff(`x ${ID}`, {
      classify: cls("refund"),
      runAgent: agent({ toolResults: results }),
    });
    assert.equal(r.outcome, "resolved");
    assert.equal(r.handoff, null);
    assert.equal(r.reply, "Model words.");
  }
});

test("two tool errors escalate; one does not", async () => {
  const bad = {
    name: "mcp__storefront__get_order",
    isError: true,
    body: { error: "x" },
  };
  const two = await handleWithHandoff("x", {
    classify: cls("order_status"),
    runAgent: agent({ toolResults: [bad, bad] }),
  });
  assert.equal(two.escalation.trigger, "tool_failure");
  assert.equal(two.handoff.findings.length, 0);
  const one = await handleWithHandoff("x", {
    classify: cls("order_status"),
    runAgent: agent({ toolResults: [bad] }),
  });
  assert.equal(one.outcome, "resolved");
});

test("step cap and agent crash escalate with the fixed fallback reply", async () => {
  const cap = await handleWithHandoff("x", {
    classify: cls("refund"),
    runAgent: agent({ forcedReason: "step_cap" }),
  });
  assert.equal(cap.escalation.trigger, "step_cap");
  assert.doesNotMatch(cap.reply, /Model words/);
  const crash = await handleWithHandoff("x", {
    classify: cls("refund"),
    runAgent: async () => {
      throw new Error("boom");
    },
  });
  assert.equal(crash.escalation.trigger, "specialist_error");
  assert.equal(validateHandoff(crash.handoff).ok, true);
});

test("out of scope runs the agent and does not escalate", async () => {
  const r = await handleWithHandoff("best laptop?", {
    classify: cls("out_of_scope"),
    runAgent: agent(),
  });
  assert.equal(r.outcome, "resolved");
});
