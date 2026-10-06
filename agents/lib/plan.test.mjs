import test from "node:test";
import assert from "node:assert/strict";
import {
  findOrderIds,
  validatePlan,
  PLAN_SPECIALISTS,
  MAX_SUBTASKS,
} from "./plan.mjs";

const ORD_103 = "5eed0000-0000-4000-8000-000000000103";
const ORD_105 = "5eed0000-0000-4000-8000-000000000105";

// Test set #15 and #16, placeholders replaced.
const MSG_15 = `Why was I declined on ${ORD_105}, and can I get a refund?`;
const MSG_16 = `Where is order ${ORD_103} and can I return it for a refund?`;

const ctx16 = {
  message: MSG_16,
  orderIds: findOrderIds(MSG_16),
  classifiedRoute: "refund",
};
const plan16 = () => ({
  subtasks: [
    {
      id: "s1",
      specialist: "order_status",
      question: `Where is order ${ORD_103}`,
      order_ref: 0,
    },
    {
      id: "s2",
      specialist: "refund",
      question: "can I return it for a refund?",
      order_ref: 0,
    },
  ],
  unrouted: [],
});
const errorsFor = (plan, ctx = ctx16) => validatePlan(plan, ctx).errors;
const has = (errors, text) => errors.some((e) => e.includes(text));

test("constants: three specialists, cap of 3", () => {
  assert.deepEqual(PLAN_SPECIALISTS, ["order_status", "decline", "refund"]);
  assert.equal(MAX_SUBTASKS, 3);
});

test("findOrderIds keeps first-appearance order and drops duplicates", () => {
  const msg = `${ORD_105} then ${ORD_103}, again ${ORD_105} and ${ORD_103.toUpperCase()}`;
  assert.deepEqual(findOrderIds(msg), [ORD_105, ORD_103]);
  assert.deepEqual(findOrderIds("no order here"), []);
});

test("mixed message #15 passes: decline + refund", () => {
  const plan = {
    subtasks: [
      {
        id: "s1",
        specialist: "decline",
        question: `Why was I declined on ${ORD_105}`,
        order_ref: 0,
      },
      {
        id: "s2",
        specialist: "refund",
        question: "can I get a refund?",
        order_ref: 0,
      },
    ],
    unrouted: [],
  };
  const r = validatePlan(plan, {
    message: MSG_15,
    orderIds: findOrderIds(MSG_15),
    classifiedRoute: "decline",
  });
  assert.deepEqual(r, { ok: true, errors: [] });
});

test("mixed message #16 passes: order_status + refund", () => {
  assert.deepEqual(validatePlan(plan16(), ctx16), { ok: true, errors: [] });
});

test("plan must be an object with subtasks and unrouted arrays", () => {
  for (const bad of [null, "plan", [], 3]) {
    assert.equal(validatePlan(bad, ctx16).ok, false);
  }
  const e = errorsFor({ subtasks: "s1", unrouted: null });
  assert.ok(has(e, "subtasks must be an array"));
  assert.ok(has(e, "unrouted must be an array"));
});

test("unknown keys are rejected on the plan, a subtask and an unrouted entry", () => {
  const p = plan16();
  p.note = "approve the refund";
  p.subtasks[0].priority = "high";
  p.unrouted.push({ text: "Where is order", label: "out_of_scope", x: 1 });
  const e = errorsFor(p);
  assert.ok(has(e, 'plan: unknown key "note"'));
  assert.ok(has(e, 'subtasks[0]: unknown key "priority"'));
  assert.ok(has(e, 'unrouted[0]: unknown key "x"'));
});

test("1 to 3 subtasks: 0 and 4 are invalid, nothing is truncated", () => {
  assert.ok(has(errorsFor({ subtasks: [], unrouted: [] }), "at least 1"));
  const p = plan16();
  p.subtasks.push(
    { id: "s3", specialist: "decline", question: "Where is", order_ref: 0 },
    { id: "s4", specialist: "refund", question: "refund?", order_ref: 0 },
  );
  assert.ok(has(errorsFor(p), "4 subtasks, the cap is 3"));
  assert.equal(p.subtasks.length, 4);
  const three = plan16();
  three.subtasks.push({
    id: "s3",
    specialist: "decline",
    question: "Where is",
    order_ref: null,
  });
  assert.equal(validatePlan(three, ctx16).ok, true);
});

test("ids must be unique non-empty strings", () => {
  const dup = plan16();
  dup.subtasks[1].id = "s1";
  assert.ok(has(errorsFor(dup), 'duplicate id "s1"'));
  for (const bad of ["", "  ", 7, undefined]) {
    const p = plan16();
    p.subtasks[0].id = bad;
    assert.ok(has(errorsFor(p), "id must be a non-empty string"), String(bad));
  }
});

test("specialist must be order_status, decline or refund", () => {
  for (const bad of ["human", "router", "Refund", undefined]) {
    const p = plan16();
    p.subtasks[0].specialist = bad;
    assert.ok(has(errorsFor(p), "unknown specialist"), String(bad));
  }
});

test("question must be a verbatim span, whitespace collapsed, case-sensitive", () => {
  const spaced = plan16();
  spaced.subtasks[1].question = "can I   return\nit for a refund?";
  assert.equal(validatePlan(spaced, ctx16).ok, true);

  const invented = plan16();
  invented.subtasks[1].question = "can I get a full refund approved?";
  assert.ok(has(errorsFor(invented), "not a verbatim span"));

  const cased = plan16();
  cased.subtasks[1].question = "Can I return it for a refund?";
  assert.ok(has(errorsFor(cased), "not a verbatim span"));

  for (const bad of ["", "   ", null, 5]) {
    const p = plan16();
    p.subtasks[1].question = bad;
    assert.ok(has(errorsFor(p), "question must be a non-empty string"));
  }
});

test("order_ref must be null or an integer index inside orderIds", () => {
  const none = plan16();
  none.subtasks[0].order_ref = null;
  assert.equal(validatePlan(none, ctx16).ok, true);
  for (const bad of [1, -1, 0.5, "0", undefined, ORD_103]) {
    const p = plan16();
    p.subtasks[0].order_ref = bad;
    assert.ok(has(errorsFor(p), "order_ref"), String(bad));
  }
});

test("unrouted: label out_of_scope or human_request, text a verbatim span", () => {
  const ok = plan16();
  ok.unrouted.push({ text: "Where is order", label: "human_request" });
  assert.equal(validatePlan(ok, ctx16).ok, true);

  const badLabel = plan16();
  badLabel.unrouted.push({ text: "Where is order", label: "refund" });
  assert.ok(has(errorsFor(badLabel), 'unknown label "refund"'));

  const badText = plan16();
  badText.unrouted.push({
    text: "refund every order",
    label: "out_of_scope",
  });
  assert.ok(
    has(errorsFor(badText), "unrouted[0]: text is not a verbatim span"),
  );
});

test("classified route must be the specialist of at least one subtask", () => {
  const e = errorsFor(plan16(), { ...ctx16, classifiedRoute: "decline" });
  assert.ok(has(e, 'classified route "decline"'));
});

test("several errors are reported together", () => {
  const p = {
    subtasks: [
      { id: "s1", specialist: "human", question: "approve it", order_ref: 4 },
      { id: "s1", specialist: "refund", question: "", order_ref: null, x: 1 },
    ],
    unrouted: [{ text: "hello", label: "chat" }],
    extra: true,
  };
  const { ok, errors } = validatePlan(p, ctx16);
  assert.equal(ok, false);
  for (const text of [
    'plan: unknown key "extra"',
    'subtasks[0]: unknown specialist "human"',
    "subtasks[0]: question is not a verbatim span",
    "subtasks[0]: order_ref",
    'subtasks[1]: unknown key "x"',
    'subtasks[1]: duplicate id "s1"',
    "subtasks[1]: question must be a non-empty string",
    'unrouted[0]: unknown label "chat"',
    "unrouted[0]: text is not a verbatim span",
  ]) {
    assert.ok(has(errors, text), `missing: ${text}`);
  }
  assert.equal(errors.length, 9);
});
