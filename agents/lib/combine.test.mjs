import test from "node:test";
import assert from "node:assert/strict";
import { combineEscalation, TRIGGER_PRIORITY } from "./combine.mjs";
import { TRIGGERS } from "./handoff.mjs";

const answered = (id, { forcedReason, toolErrors = 0, verdict } = {}) => ({
  id,
  specialist: "refund",
  status: "answered",
  loop: { forcedReason, toolErrors },
  refundDecision: verdict ? { verdict } : null,
});

// One subtask that produces each trigger.
const CASES = {
  api_error: (id) => answered(id, { forcedReason: "api_error: 529" }),
  step_cap: (id) => answered(id, { forcedReason: "step_cap" }),
  empty_reply: (id) => answered(id, { forcedReason: "empty_final_reply" }),
  unexpected_stop: (id) =>
    answered(id, { forcedReason: "unexpected_stop_reason: max_tokens" }),
  specialist_error: (id) => ({ id, specialist: "refund", status: "failed" }),
  tool_failure: (id) => answered(id, { toolErrors: 2 }),
  policy_gap: (id) => answered(id, { verdict: "no_rule" }),
  refund_recommendation: (id) => answered(id, { verdict: "eligible" }),
};

test("the priority list is fixed and every entry is a known trigger", () => {
  assert.deepEqual(TRIGGER_PRIORITY, [
    "api_error",
    "step_cap",
    "empty_reply",
    "unexpected_stop",
    "specialist_error",
    "tool_failure",
    "policy_gap",
    "refund_recommendation",
  ]);
  for (const t of TRIGGER_PRIORITY) assert.ok(TRIGGERS.includes(t), t);
});

test("one subtask: each trigger escalates the session with that trigger", () => {
  for (const [trigger, make] of Object.entries(CASES)) {
    const r = combineEscalation([make("s1")]);
    assert.deepEqual(r, {
      escalate: true,
      trigger,
      perSubtask: [{ id: "s1", trigger }],
    });
  }
});

test("every pair of different triggers resolves to the higher one, in either order", () => {
  for (let i = 0; i < TRIGGER_PRIORITY.length; i++) {
    for (let j = i + 1; j < TRIGGER_PRIORITY.length; j++) {
      const hi = TRIGGER_PRIORITY[i];
      const lo = TRIGGER_PRIORITY[j];
      for (const pair of [
        [CASES[hi]("a"), CASES[lo]("b")],
        [CASES[lo]("a"), CASES[hi]("b")],
      ]) {
        const r = combineEscalation(pair);
        assert.equal(r.escalate, true);
        assert.equal(r.trigger, hi, `${hi} vs ${lo}`);
        assert.equal(r.perSubtask.length, 2);
      }
    }
  }
});

test("a failed subtask escalates with specialist_error, beside a clean one", () => {
  const r = combineEscalation([
    answered("s1", { verdict: "not_eligible" }),
    { id: "s2", specialist: "decline", status: "failed" },
  ]);
  assert.deepEqual(r, {
    escalate: true,
    trigger: "specialist_error",
    perSubtask: [
      { id: "s1", trigger: null },
      { id: "s2", trigger: "specialist_error" },
    ],
  });
});

test("skipped and not_run do not escalate by themselves, whatever they carry", () => {
  const quiet = (id, status) => ({
    ...answered(id, {
      forcedReason: "step_cap",
      toolErrors: 3,
      verdict: "eligible",
    }),
    status,
  });
  const r = combineEscalation([quiet("s1", "skipped"), quiet("s2", "not_run")]);
  assert.deepEqual(r, {
    escalate: false,
    trigger: null,
    perSubtask: [
      { id: "s1", trigger: null },
      { id: "s2", trigger: null },
    ],
  });
});

test("nothing escalates: clean answers give no trigger", () => {
  const r = combineEscalation([
    { ...answered("s1"), specialist: "order_status" },
    { ...answered("s2", { toolErrors: 1 }), specialist: "decline" },
    answered("s3", { verdict: "not_found" }),
  ]);
  assert.equal(r.escalate, false);
  assert.equal(r.trigger, null);
  assert.ok(r.perSubtask.every((p) => p.trigger === null));
});

test("exhaustive over 3 subtasks: session trigger is known when escalating, null otherwise", () => {
  const forced = [
    undefined,
    "step_cap",
    "api_error: x",
    "empty_final_reply",
    "unexpected_stop_reason: y",
    "specialist_error: z",
    "other",
  ];
  const verdicts = [null, "eligible", "not_eligible", "no_rule", "not_found"];
  const specialists = ["order_status", "decline", "refund"];
  // Every answered input the escalation rules distinguish, plus the three
  // other statuses (which ignore loop and verdict). Specialists rotate: the
  // rules read the same fields for all three.
  const variants = [];
  for (const forcedReason of forced) {
    for (const toolErrors of [0, 1, 2]) {
      for (const verdict of verdicts) {
        variants.push({
          specialist: specialists[variants.length % 3],
          status: "answered",
          loop: { forcedReason, toolErrors },
          refundDecision: verdict ? { verdict } : null,
        });
      }
    }
  }
  for (const status of ["failed", "skipped", "not_run"]) {
    for (const specialist of specialists) variants.push({ specialist, status });
  }
  let count = 0;
  for (const a of variants) {
    for (const b of variants) {
      for (const c of variants) {
        const r = combineEscalation([
          { id: "s1", ...a },
          { id: "s2", ...b },
          { id: "s3", ...c },
        ]);
        const fired = r.perSubtask.filter((p) => p.trigger);
        if (r.escalate) {
          assert.ok(TRIGGERS.includes(r.trigger), r.trigger);
          assert.ok(fired.some((p) => p.trigger === r.trigger));
        } else {
          assert.equal(r.trigger, null);
          assert.equal(fired.length, 0);
        }
        count++;
      }
    }
  }
  assert.equal(count, variants.length ** 3); // 114^3 = 1,481,544
});
