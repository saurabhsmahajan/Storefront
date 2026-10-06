// Dispatch tests with stub classifier, planner and specialists passed through
// deps. No model, no database, no network: importing dispatch.mjs only reads
// prompt files and constructs clients; nothing here calls them.
import test from "node:test";
import assert from "node:assert/strict";
import { handleMessage, NOT_ROUTABLE_NOTE } from "./dispatch.mjs";
import { validateHandoff } from "../lib/handoff.mjs";
import { FALLBACK_REPLY } from "../lib/loop.mjs";
import {
  REFUND_RECOMMENDATION_LINE,
  UNANSWERED_PREFIX,
} from "../lib/merge.mjs";

const ORD_103 = "5eed0000-0000-4000-8000-000000000103";
const ORD_105 = "5eed0000-0000-4000-8000-000000000105";
const OUT_OF_SCOPE_REPLY =
  "I can help with order status, payment problems and refunds. If you have an order ID, send it and I'll look into it. If you'd like to talk to a person, tell me and I'll pass you to a human agent.";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const count = (text, part) => text.split(part).length - 1;

// Every result from every test, checked again by test 15.
const ALL = [];
function checkInvariant(r) {
  assert.ok(["resolved", "escalated"].includes(r.outcome), r.outcome);
  if (r.outcome === "escalated") {
    assert.ok(r.handoff, "escalated result carries a package");
    assert.deepEqual(validateHandoff(r.handoff), { ok: true, errors: [] });
    assert.equal(r.handoff.authorization.refund_approved, false);
  }
}
async function run(message, deps) {
  const r = await handleMessage(message, deps);
  ALL.push(r);
  checkInvariant(r);
  return r;
}

// Stub specialists shaped like real results. Each records every string it
// receives in calls[name].
const base = (reply) => ({
  outcome: "resolved",
  reply,
  steps: [],
  escalation: null,
  forcedReason: null,
  toolErrors: 0,
});
const DEFAULTS = {
  order_status: (o) => ({
    ...base(o.reply ?? "Your order is paid."),
    lookup: o.lookup ?? {
      found: true,
      status: "paid",
      total: "1599.00 INR",
      order_date: "2026-10-03",
      age_days: 3,
    },
  }),
  decline: (o) => ({
    ...base(o.reply ?? "The bank declined the card."),
    handoffRaw: o.handoffRaw ?? [
      { order_id: ORD_105, reason: "Not enough balance", tier: "plain" },
    ],
  }),
  refund: (o) => ({
    ...base(o.reply ?? "This order is not eligible for a refund."),
    decision: {
      verdict: o.verdict ?? "not_eligible",
      reason: o.reason ?? "never_paid",
      facts: { status: "pending", authorised: false, captured: false },
    },
  }),
};
function makeSpecialists(opts = {}) {
  const calls = { order_status: [], decline: [], refund: [] };
  const specialists = {};
  for (const name of Object.keys(DEFAULTS)) {
    const o = opts[name] ?? {};
    specialists[name] = async (input) => {
      calls[name].push(input);
      if (o.delay) await sleep(o.delay);
      if (o.throws) throw new Error(`${name} exploded`);
      if (o.forcedReason) {
        return {
          ...DEFAULTS[name](o),
          outcome: "escalated",
          reply: FALLBACK_REPLY,
          forcedReason: o.forcedReason,
          forced: true,
        };
      }
      return DEFAULTS[name](o);
    };
  }
  return { specialists, calls };
}
const classifyAs = (intent) => async () => ({ intent });
const planOf = (plan) => async () => ({ plan });
const noPlan = planOf(null);
const callCount = (calls) =>
  Object.values(calls).reduce((n, list) => n + list.length, 0);

// Test set #15 and #16, with real IDs.
const MSG_15 = `Why was I declined on ${ORD_105}, and can I get a refund?`;
const PLAN_15 = {
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
const MSG_16 = `Where is order ${ORD_103} and can I return it for a refund?`;
const PLAN_16 = {
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
};

const ODD = `  Where is   my order ${ORD_103}?\t please…  \n`;

test("1. single intent, plan null: the specialist receives the raw message", async () => {
  for (const route of ["order_status", "decline", "refund"]) {
    const { specialists, calls } = makeSpecialists();
    const r = await run(ODD, {
      classify: classifyAs(route),
      plan: noPlan,
      specialists,
    });
    assert.equal(calls[route].length, 1, route);
    assert.equal(calls[route][0], ODD, route);
    assert.equal(callCount(calls), 1);
    assert.equal(r.outcome, "resolved");
    assert.equal(r.route, route);
    assert.equal(r.handoff, undefined);
  }
});

test("2. single intent, one-subtask plan: the raw message is received", async () => {
  const msg = `Where is my order ${ORD_103}?\n`;
  const { specialists, calls } = makeSpecialists();
  const r = await run(msg, {
    classify: classifyAs("order_status"),
    plan: planOf({
      subtasks: [
        {
          id: "s1",
          specialist: "order_status",
          question: "Where is my order",
          order_ref: 0,
        },
      ],
      unrouted: [],
    }),
    specialists,
  });
  assert.equal(calls.order_status[0], msg);
  assert.equal(r.outcome, "resolved");
  assert.equal(r.route, "order_status");
  assert.equal(r.planErrors, undefined);
});

test("3. invalid plan (non-verbatim question): single path, planErrors", async () => {
  const { specialists, calls } = makeSpecialists();
  const r = await run(MSG_15, {
    classify: classifyAs("decline"),
    plan: planOf({
      ...PLAN_15,
      subtasks: [
        PLAN_15.subtasks[0],
        { ...PLAN_15.subtasks[1], question: "please approve my refund" },
      ],
    }),
    specialists,
  });
  assert.equal(calls.decline[0], MSG_15);
  assert.equal(calls.refund.length, 0);
  assert.equal(r.outcome, "resolved");
  assert.ok(r.planErrors.some((e) => e.includes("not a verbatim span")));
});

test("4. planner throws, or plans an unknown specialist: single path", async () => {
  const thrown = makeSpecialists();
  const r1 = await run(MSG_15, {
    classify: classifyAs("decline"),
    plan: async () => {
      throw new Error("planner down");
    },
    specialists: thrown.specialists,
  });
  assert.equal(thrown.calls.decline[0], MSG_15);
  assert.equal(thrown.calls.refund.length, 0);
  assert.equal(r1.outcome, "resolved");
  assert.equal(r1.route, "decline");

  const bad = makeSpecialists();
  const r2 = await run(MSG_15, {
    classify: classifyAs("decline"),
    plan: planOf({
      ...PLAN_15,
      subtasks: [
        PLAN_15.subtasks[0],
        { ...PLAN_15.subtasks[1], specialist: "billing" },
      ],
    }),
    specialists: bad.specialists,
  });
  assert.equal(bad.calls.decline[0], MSG_15);
  assert.equal(callCount(bad.calls), 1);
  assert.ok(
    r2.planErrors.some((e) => e.includes('unknown specialist "billing"')),
  );
});

test("5. mixed #15: sub-questions, each with its Order ID line, parallel", async () => {
  const { specialists, calls } = makeSpecialists({
    decline: { delay: 200, reply: "Declined: check your funds." },
    refund: { delay: 200, reply: "Nothing was charged, so no refund." },
  });
  const r = await run(MSG_15, {
    classify: classifyAs("decline"),
    plan: planOf(PLAN_15),
    specialists,
  });
  assert.deepEqual(calls.decline, [
    `Why was I declined on ${ORD_105}\nOrder ID: ${ORD_105}`,
  ]);
  assert.deepEqual(calls.refund, [`can I get a refund?\nOrder ID: ${ORD_105}`]);
  assert.ok(r.ms < 380, `ms ${r.ms}`);
  assert.equal(
    r.reply,
    "Declined: check your funds.\n\nNothing was charged, so no refund.",
  );
  assert.equal(r.outcome, "resolved");
  assert.equal(r.route, "multi:decline+refund");
});

test("6. mixed #16, eligible refund: one handoff line, findings for both", async () => {
  const { specialists } = makeSpecialists({
    refund: {
      verdict: "eligible",
      reason: "within_window",
      reply:
        "It qualifies for a full refund. A human agent decides every refund.",
    },
  });
  const r = await run(MSG_16, {
    classify: classifyAs("refund"),
    plan: planOf(PLAN_16),
    specialists,
  });
  assert.equal(r.outcome, "escalated");
  assert.equal(r.escalation.trigger, "refund_recommendation");
  assert.equal(count(r.reply, REFUND_RECOMMENDATION_LINE), 1);
  assert.ok(r.reply.endsWith(REFUND_RECOMMENDATION_LINE));
  const p = r.handoff;
  assert.deepEqual(validateHandoff(p), { ok: true, errors: [] });
  assert.equal(p.authorization.refund_approved, false);
  assert.equal(p.from, "system");
  assert.equal(p.customer_message, MSG_16);
  const ids = new Set(p.findings.map((f) => f.subtask_id));
  assert.deepEqual([...ids].sort(), ["s1", "s2"]);
  assert.ok(p.findings.every((f) => typeof f.subtask_id === "string"));
  assert.ok(p.findings.some((f) => f.source === "orders"));
  assert.ok(p.findings.some((f) => f.verdict === "eligible"));
});

test("7. one subtask throws: the other answers, part marked unanswered", async () => {
  const { specialists } = makeSpecialists({
    decline: { reply: "Declined: check your funds." },
    refund: { throws: true },
  });
  const r = await run(MSG_15, {
    classify: classifyAs("decline"),
    plan: planOf(PLAN_15),
    specialists,
  });
  assert.equal(r.outcome, "escalated");
  assert.equal(r.escalation.trigger, "specialist_error");
  assert.ok(r.reply.includes("Declined: check your funds."));
  const lines = r.reply
    .split("\n")
    .filter((l) => l.startsWith(UNANSWERED_PREFIX));
  assert.deepEqual(lines, [`${UNANSWERED_PREFIX}"can I get a refund?"`]);
  assert.deepEqual(r.handoff.context.unanswered, [
    { part: "can I get a refund?", reason: "specialist_failed" },
  ]);
  const s2 = r.handoff.context.subtasks.find((s) => s.id === "s2");
  assert.equal(s2.status, "failed");
  assert.match(s2.error, /refund exploded/);
});

test("8. a forced step_cap subtask: fallback text dropped, step_cap, unanswered", async () => {
  const { specialists } = makeSpecialists({
    decline: { reply: "Declined: check your funds." },
    refund: { forcedReason: "step_cap" },
  });
  const r = await run(MSG_15, {
    classify: classifyAs("decline"),
    plan: planOf(PLAN_15),
    specialists,
  });
  assert.equal(r.outcome, "escalated");
  assert.equal(r.escalation.trigger, "step_cap");
  // FALLBACK_REPLY appears once, as the session handoff line, not as an answer.
  assert.equal(count(r.reply, FALLBACK_REPLY), 1);
  assert.equal(
    r.reply,
    [
      "Declined: check your funds.",
      `${UNANSWERED_PREFIX}"can I get a refund?"`,
      FALLBACK_REPLY,
    ].join("\n\n"),
  );
  assert.deepEqual(r.handoff.context.unanswered, [
    { part: "can I get a refund?", reason: "specialist_failed" },
  ]);
});

test("9. all subtasks fail: the reply is FALLBACK_REPLY only", async () => {
  const { specialists } = makeSpecialists({
    decline: { throws: true },
    refund: { forcedReason: "api_error: 529" },
  });
  const r = await run(MSG_15, {
    classify: classifyAs("decline"),
    plan: planOf(PLAN_15),
    specialists,
  });
  assert.equal(r.outcome, "escalated");
  assert.equal(r.reply, FALLBACK_REPLY);
  assert.equal(r.handoff.context.unanswered.length, 2);
});

test("10. unrouted human_request: R1 fires, no specialist is called", async () => {
  const msg = `Where is ${ORD_103}? Actually, get me a person.`;
  const { specialists, calls } = makeSpecialists();
  const r = await run(msg, {
    classify: classifyAs("order_status"),
    plan: planOf({
      subtasks: [
        {
          id: "s1",
          specialist: "order_status",
          question: `Where is ${ORD_103}?`,
          order_ref: 0,
        },
      ],
      unrouted: [
        { text: "Actually, get me a person.", label: "human_request" },
      ],
    }),
    specialists,
  });
  assert.equal(callCount(calls), 0);
  assert.equal(r.outcome, "escalated");
  assert.equal(r.escalation.trigger, "explicit_human_request");
  assert.deepEqual(r.steps, []);
  assert.equal(r.handoff.from, "router");
  assert.equal(r.handoff.order_id, ORD_103);
});

test("11. unrouted out_of_scope: the note comes last, before any handoff line", async () => {
  const msg = `Where is order ${ORD_103} and can I return it for a refund? Also, which laptop should I buy?`;
  const plan = {
    ...PLAN_16,
    unrouted: [{ text: "which laptop should I buy?", label: "out_of_scope" }],
  };
  const quiet = makeSpecialists();
  const r1 = await run(msg, {
    classify: classifyAs("refund"),
    plan: planOf(plan),
    specialists: quiet.specialists,
  });
  assert.equal(r1.outcome, "resolved");
  assert.ok(r1.reply.endsWith(NOT_ROUTABLE_NOTE));
  assert.equal(count(r1.reply, NOT_ROUTABLE_NOTE), 1);

  const loud = makeSpecialists({ refund: { verdict: "eligible" } });
  const r2 = await run(msg, {
    classify: classifyAs("refund"),
    plan: planOf(plan),
    specialists: loud.specialists,
  });
  assert.equal(r2.outcome, "escalated");
  assert.ok(
    r2.reply.endsWith(`${NOT_ROUTABLE_NOTE}\n\n${REFUND_RECOMMENDATION_LINE}`),
  );
  assert.deepEqual(r2.handoff.context.unanswered, [
    { part: "which laptop should I buy?", reason: "not_routable" },
  ]);
});

test("12. a subtask slower than timeoutMs fails; a late result changes nothing", async () => {
  const { specialists, calls } = makeSpecialists({
    decline: { reply: "Declined: check your funds." },
    refund: { delay: 300, verdict: "eligible" },
  });
  const r = await run(MSG_15, {
    classify: classifyAs("decline"),
    plan: planOf(PLAN_15),
    specialists,
    timeoutMs: 100,
  });
  assert.equal(calls.refund.length, 1);
  assert.equal(r.outcome, "escalated");
  assert.equal(r.escalation.trigger, "specialist_error");
  const s2 = r.handoff.context.subtasks.find((s) => s.id === "s2");
  assert.equal(s2.status, "failed");
  assert.equal(s2.error, "timeout");
  assert.ok(r.reply.includes("Declined: check your funds."));
  const before = structuredClone(r);
  await sleep(350); // the late refund result (eligible) arrives here
  assert.deepEqual(r, before);
  assert.equal(r.escalation.trigger, "specialist_error");
  assert.ok(!r.handoff.findings.some((f) => f.verdict === "eligible"));
});

test("13. classifier human_request and out_of_scope keep their paths", async () => {
  const human = makeSpecialists();
  const r1 = await run(MSG_16, {
    classify: classifyAs("human_request"),
    plan: planOf(PLAN_16),
    specialists: human.specialists,
  });
  assert.equal(callCount(human.calls), 0);
  assert.equal(r1.outcome, "escalated");
  assert.equal(r1.route, "human_request");
  assert.equal(r1.escalation.trigger, "explicit_human_request");
  assert.deepEqual(r1.steps, []);
  assert.equal(r1.handoff.context.multi, undefined);
  assert.equal(r1.handoff.context.steps, 0);

  const oos = makeSpecialists();
  const r2 = await run("What's the best laptop under 50,000 rupees?", {
    classify: classifyAs("out_of_scope"),
    plan: planOf(PLAN_16),
    specialists: oos.specialists,
  });
  assert.equal(callCount(oos.calls), 0);
  assert.equal(r2.outcome, "resolved");
  assert.equal(r2.reply, OUT_OF_SCOPE_REPLY);
  assert.deepEqual(r2.steps, []);
});

test("14. a FRAUD reason reaches the human package only, never the reply", async () => {
  const msg = `Why did my payment fail on ${ORD_105}, and can I get a refund?`;
  const generic =
    "The payment could not be processed. Contact your bank or try another payment method.";
  const { specialists } = makeSpecialists({
    decline: {
      reply: generic,
      handoffRaw: [{ order_id: ORD_105, reason: "FRAUD", tier: "generic" }],
    },
    refund: { verdict: "eligible" },
  });
  const r = await run(msg, {
    classify: classifyAs("decline"),
    plan: planOf({
      subtasks: [
        {
          id: "s1",
          specialist: "decline",
          question: `Why did my payment fail on ${ORD_105}`,
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
    }),
    specialists,
  });
  assert.equal(r.outcome, "escalated");
  assert.doesNotMatch(r.reply, /fraud/i);
  assert.doesNotMatch(r.handoff.customer_told, /fraud/i);
  const raw = r.handoff.findings.find((f) => f.source === "payment_events");
  assert.equal(raw.raw_reason, "FRAUD");
  assert.equal(raw.subtask_id, "s1");
});

test("16. exhaustive: 3 subtasks x {answered, throws, step_cap}", async () => {
  const msg = `For order ${ORD_105}: what's its status, why did my payment fail, and can I get a refund?`;
  const plan = {
    subtasks: [
      {
        id: "s1",
        specialist: "order_status",
        question: "what's its status",
        order_ref: 0,
      },
      {
        id: "s2",
        specialist: "decline",
        question: "why did my payment fail",
        order_ref: 0,
      },
      {
        id: "s3",
        specialist: "refund",
        question: "can I get a refund?",
        order_ref: 0,
      },
    ],
    unrouted: [],
  };
  const modes = {
    answered: {},
    throws: { throws: true },
    step_cap: { forcedReason: "step_cap" },
  };
  let n = 0;
  for (const a of Object.keys(modes)) {
    for (const b of Object.keys(modes)) {
      for (const c of Object.keys(modes)) {
        const { specialists } = makeSpecialists({
          order_status: modes[a],
          decline: modes[b],
          refund: modes[c],
        });
        const r = await run(msg, {
          classify: classifyAs("order_status"),
          plan: planOf(plan),
          specialists,
        });
        const label = `${a}/${b}/${c}`;
        const anyFailed = [a, b, c].some((m) => m !== "answered");
        assert.equal(r.outcome, anyFailed ? "escalated" : "resolved", label);
        if (anyFailed) {
          const failed = [a, b, c].filter((m) => m !== "answered").length;
          assert.equal(r.handoff.context.unanswered.length, failed, label);
        }
        if ([a, b, c].every((m) => m !== "answered")) {
          assert.equal(r.reply, FALLBACK_REPLY, label);
        }
        n++;
      }
    }
  }
  assert.equal(n, 27);
});

test("17. single intent, two order IDs: raw message, package uses the first ID", async () => {
  const msg = `Please refund ${ORD_103} and ${ORD_105}.`;
  const { specialists, calls } = makeSpecialists({
    refund: { verdict: "eligible" },
  });
  const r = await run(msg, {
    classify: classifyAs("refund"),
    plan: noPlan,
    specialists,
  });
  assert.equal(calls.refund[0], msg);
  assert.equal(r.outcome, "escalated");
  assert.equal(r.escalation.trigger, "refund_recommendation");
  assert.equal(r.handoff.order_id, ORD_103);
});

test("18. two-order split: each specialist gets its own order's line only", async () => {
  const ORD_104 = "5eed0000-0000-4000-8000-000000000104";
  const msg = `Where is order ${ORD_103}, and can I get a refund on ${ORD_104}?`;
  const { specialists, calls } = makeSpecialists();
  const r = await run(msg, {
    classify: classifyAs("order_status"),
    plan: planOf({
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
          question: `can I get a refund on ${ORD_104}?`,
          order_ref: 1,
        },
      ],
      unrouted: [],
    }),
    specialists,
  });
  assert.deepEqual(calls.order_status, [
    `Where is order ${ORD_103}\nOrder ID: ${ORD_103}`,
  ]);
  assert.deepEqual(calls.refund, [
    `can I get a refund on ${ORD_104}?\nOrder ID: ${ORD_104}`,
  ]);
  assert.ok(!calls.order_status[0].includes(ORD_104));
  assert.ok(!calls.refund[0].includes(ORD_103));
  assert.equal(r.route, "multi:order_status+refund");
});

// Runs last: node:test runs top-level tests in file order.
test("15. every result ends resolved or escalated, every package validates", () => {
  assert.ok(ALL.length >= 40, `checked ${ALL.length} results`);
  for (const r of ALL) checkInvariant(r);
  assert.ok(ALL.some((r) => r.outcome === "resolved"));
  assert.ok(ALL.some((r) => r.outcome === "escalated"));
});
