import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHandoff,
  buildSubtaskHandoff,
  renderForSpecialist,
  validateHandoff,
} from "./handoff.mjs";

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

// Router to specialist (routed_subtask).
const ORD_103 = "5eed0000-0000-4000-8000-000000000103";
const ORD_105 = "5eed0000-0000-4000-8000-000000000105";
const routed = (subtask, planSize = 2, orderId = ORD_103) =>
  buildSubtaskHandoff({
    subtask: { id: "s1", specialist: "order_status", ...subtask },
    orderId,
    classification: "refund",
    planSize,
  });
const rejects = (p, text) => {
  const v = validateHandoff(p);
  assert.equal(v.ok, false);
  assert.ok(
    v.errors.some((e) => e.includes(text)),
    v.errors.join("; "),
  );
};

test("a routed subtask package is built and validates", () => {
  const p = routed({ question: `Where is order ${ORD_103}` });
  assert.equal(p.from, "router");
  assert.equal(p.to, "order_status");
  assert.equal(p.trigger, "routed_subtask");
  assert.equal(p.customer_message, `Where is order ${ORD_103}`);
  assert.equal(p.order_id, ORD_103);
  assert.deepEqual(p.findings, []);
  assert.deepEqual(p.context, {
    classification: "refund",
    subtask_id: "s1",
    plan_size: 2,
  });
  assert.deepEqual(validateHandoff(p), { ok: true, errors: [] });
});
test("a routed subtask package says nothing is approved", () => {
  const p = routed({ specialist: "refund", question: "can I get a refund?" });
  assert.equal(p.authorization.refund_approved, false);
  assert.equal(p.authorization.approved_by, null);
});
test("plan_size 1: the specialist receives the raw message unchanged", () => {
  const messages = [
    { text: `Where is my order ${ORD_103}?`, id: ORD_103 },
    { text: `Why was my payment declined for order ${ORD_105}?`, id: ORD_105 },
    {
      text: `  Order  ${ORD_105.toUpperCase()}…\t why?!  "declined" — again?? (twice)\n\n`,
      id: ORD_105,
    },
    { text: "Where's my order?? 🙁", id: ORD_103 },
  ];
  for (const { text, id } of messages) {
    const p = routed({ question: text }, 1, id);
    assert.equal(renderForSpecialist(p), text);
  }
});
test("a split question without the order ID gets an Order ID line", () => {
  const p = routed({ specialist: "refund", question: "can I get a refund?" });
  assert.equal(
    renderForSpecialist(p),
    `can I get a refund?\nOrder ID: ${ORD_103}`,
  );
});
test("no Order ID line when the question already has the ID, any case", () => {
  for (const q of [
    `Where is order ${ORD_103}`,
    `Where is order ${ORD_103.toUpperCase()}`,
  ]) {
    assert.equal(renderForSpecialist(routed({ question: q })), q);
  }
});
test("no Order ID line when there is no order ID", () => {
  const p = routed({ question: "can I get a refund?" }, 2, null);
  assert.equal(renderForSpecialist(p), "can I get a refund?");
});
test("validation rejects a routed package with findings", () => {
  const p = structuredClone(routed({ question: "Where is order" }));
  p.findings = [{ source: "router", guess: "paid" }];
  rejects(p, "findings must be empty");
});
test("validation rejects a routed package addressed to human", () => {
  const p = structuredClone(routed({ question: "Where is order" }));
  p.to = "human";
  rejects(p, "cannot go to human");
  rejects(routed({ specialist: "human", question: "x" }), "cannot go to human");
});
test("validation rejects a routed package with missing or zero plan_size", () => {
  for (const size of [undefined, 0, -1, 1.5, "2"]) {
    const p = structuredClone(routed({ question: "Where is order" }));
    p.context.plan_size = size;
    if (size === undefined) delete p.context.plan_size;
    rejects(p, "plan_size");
  }
});
