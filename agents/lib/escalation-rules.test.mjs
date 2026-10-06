import test from "node:test";
import assert from "node:assert/strict";
import { decideEscalation } from "./escalation-rules.mjs";
import { TRIGGERS } from "./handoff.mjs";

const v = (verdict) => ({ verdict });

test("R1: a human request escalates immediately, with no tools first", () => {
  const r = decideEscalation({ route: "human_request" });
  assert.deepEqual(r, {
    escalate: true,
    trigger: "explicit_human_request",
    tryToolsFirst: false,
  });
});
test("R1 beats everything else", () => {
  const r = decideEscalation({
    route: "human_request",
    loop: { forcedReason: "step_cap", toolErrors: 5 },
    refundDecision: v("eligible"),
  });
  assert.equal(r.trigger, "explicit_human_request");
});
test("R2: no valid label and a router failure escalate", () => {
  assert.equal(
    decideEscalation({ route: "unknown" }).trigger,
    "router_no_label",
  );
  assert.equal(decideEscalation({ route: null }).trigger, "router_no_label");
  assert.equal(
    decideEscalation({ route: "router_error" }).trigger,
    "api_error",
  );
});
test("R3: each forced loop failure maps to its trigger, tools tried first", () => {
  const cases = {
    step_cap: "step_cap",
    "api_error: 529": "api_error",
    empty_final_reply: "empty_reply",
    "unexpected_stop_reason: max_tokens": "unexpected_stop",
    "specialist_error: boom": "specialist_error",
    something_new: "specialist_error",
  };
  for (const [forcedReason, trigger] of Object.entries(cases)) {
    const r = decideEscalation({ route: "refund", loop: { forcedReason } });
    assert.equal(r.trigger, trigger);
    assert.equal(r.tryToolsFirst, true);
  }
});
test("R3 beats a refund verdict", () => {
  const r = decideEscalation({
    route: "refund",
    loop: { forcedReason: "step_cap" },
    refundDecision: v("eligible"),
  });
  assert.equal(r.trigger, "step_cap");
});
test("R4: two tool errors escalate, one does not", () => {
  assert.equal(
    decideEscalation({ route: "order_status", loop: { toolErrors: 2 } })
      .trigger,
    "tool_failure",
  );
  assert.equal(
    decideEscalation({ route: "order_status", loop: { toolErrors: 1 } })
      .escalate,
    false,
  );
});
test("R5: a policy gap escalates, tools first", () => {
  const r = decideEscalation({ route: "refund", refundDecision: v("no_rule") });
  assert.deepEqual(r, {
    escalate: true,
    trigger: "policy_gap",
    tryToolsFirst: true,
  });
});
test("R6: an eligible refund goes to a human for approval", () => {
  const r = decideEscalation({
    route: "refund",
    refundDecision: v("eligible"),
  });
  assert.equal(r.trigger, "refund_recommendation");
});
test("no escalation for not_eligible, not_found or out_of_scope", () => {
  assert.equal(
    decideEscalation({ route: "refund", refundDecision: v("not_eligible") })
      .escalate,
    false,
  );
  assert.equal(
    decideEscalation({ route: "refund", refundDecision: v("not_found") })
      .escalate,
    false,
  );
  assert.equal(decideEscalation({ route: "out_of_scope" }).escalate, false);
});
test("every escalation carries a known trigger, for every input combination", () => {
  const routes = [
    "order_status",
    "decline",
    "refund",
    "human_request",
    "out_of_scope",
    "unknown",
    "router_error",
    undefined,
  ];
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
  for (const route of routes) {
    for (const forcedReason of forced) {
      for (const toolErrors of [0, 1, 2, 3]) {
        for (const verdict of verdicts) {
          const r = decideEscalation({
            route,
            loop: { forcedReason, toolErrors },
            refundDecision: verdict ? v(verdict) : null,
          });
          if (r.escalate) assert.ok(TRIGGERS.includes(r.trigger), r.trigger);
          else assert.equal(r.trigger, null);
        }
      }
    }
  }
});
