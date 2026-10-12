// Router-side time limits (finding I12) and the human request that must not
// wait for the planner (finding I14). Stub classifier, planner and specialists
// through deps: no model, no database, no network.
import test from "node:test";
import assert from "node:assert/strict";
import { handleMessage } from "./dispatch.mjs";
import { validateHandoff } from "../lib/handoff.mjs";
import { FALLBACK_REPLY } from "../lib/loop.mjs";

const ORD_103 = "5eed0000-0000-4000-8000-000000000103";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const never = () => new Promise(() => {});
const classifyAs = (intent) => async () => ({ intent });
const noPlan = async () => ({ plan: null });
const ok = (reply) => ({
  outcome: "resolved",
  reply,
  steps: [],
  escalation: null,
  forcedReason: null,
  toolErrors: 0,
});
function recorder(reply = "Your order is paid.") {
  const calls = [];
  return {
    calls,
    specialists: {
      order_status: async (input) => {
        calls.push(input);
        return ok(reply);
      },
    },
  };
}
const MSG = `Where is order ${ORD_103}?`;

test("1. a classifier that never returns: router failure, no specialist runs", async () => {
  const { calls, specialists } = recorder();
  const r = await handleMessage(MSG, {
    classify: never,
    plan: noPlan,
    specialists,
    routerTimeoutMs: 200,
  });
  assert.equal(r.outcome, "escalated");
  assert.equal(r.handoff.trigger, "api_error");
  assert.equal(r.handoff.from, "router");
  assert.deepEqual(validateHandoff(r.handoff), { ok: true, errors: [] });
  assert.equal(r.reply, FALLBACK_REPLY);
  assert.deepEqual(r.steps, []);
  assert.equal(calls.length, 0);
  assert.ok(r.ms >= 150 && r.ms < 1500, `ms ${r.ms}`);
});

test("2. a planner that never returns: the single path runs, raw message unchanged", async () => {
  const { calls, specialists } = recorder();
  const r = await handleMessage(MSG, {
    classify: classifyAs("order_status"),
    plan: never,
    specialists,
    routerTimeoutMs: 200,
  });
  assert.equal(r.outcome, "resolved");
  assert.equal(r.route, "order_status");
  assert.deepEqual(calls, [MSG]);
  assert.ok(r.ms >= 150 && r.ms < 1500, `ms ${r.ms}`);
});

test("3. a late classifier or planner failure after the timeout changes nothing", async () => {
  const { specialists } = recorder();
  const r = await handleMessage(MSG, {
    classify: async () => {
      await sleep(400);
      throw new Error("late classifier failure, nobody is listening");
    },
    plan: async () => {
      await sleep(400);
      throw new Error("late planner failure, nobody is listening");
    },
    specialists,
    routerTimeoutMs: 100,
  });
  assert.equal(r.outcome, "escalated");
  assert.equal(r.handoff.trigger, "api_error");
  await sleep(600); // an unhandled rejection here would fail the whole run
  assert.equal(r.outcome, "escalated");
});

test("4. calls inside the time limit are unaffected", async () => {
  const { calls, specialists } = recorder();
  const r = await handleMessage(MSG, {
    classify: async () => {
      await sleep(50);
      return { intent: "order_status" };
    },
    plan: async () => {
      await sleep(50);
      return { plan: null };
    },
    specialists,
    routerTimeoutMs: 1000,
  });
  assert.equal(r.outcome, "resolved");
  assert.deepEqual(calls, [MSG]);
});

test("5. a human request does not wait for a slow planner", async () => {
  const { calls, specialists } = recorder();
  const r = await handleMessage("I want to talk to a human.", {
    classify: classifyAs("human_request"),
    plan: async () => {
      await sleep(1000);
      return { plan: null };
    },
    specialists,
    routerTimeoutMs: 5000,
  });
  assert.equal(r.outcome, "escalated");
  assert.equal(r.handoff.trigger, "explicit_human_request");
  assert.equal(calls.length, 0);
  assert.ok(r.ms < 400, `ms ${r.ms}`);
});

test("6. out of scope and a no-label router do not wait for a hung planner either", async () => {
  const { calls, specialists } = recorder();
  const oos = await handleMessage("What's the best laptop?", {
    classify: classifyAs("out_of_scope"),
    plan: never,
    specialists,
    routerTimeoutMs: 600,
  });
  assert.equal(oos.outcome, "resolved");
  assert.ok(oos.ms < 400, `ms ${oos.ms}`);
  const none = await handleMessage(MSG, {
    classify: async () => ({ intent: null }),
    plan: never,
    specialists,
    routerTimeoutMs: 600,
  });
  assert.equal(none.outcome, "escalated");
  assert.equal(none.handoff.trigger, "router_no_label");
  assert.ok(none.ms < 400, `ms ${none.ms}`);
  assert.equal(calls.length, 0);
});

test("7. a planner that fails while the classifier answers: single path, resolved", async () => {
  const { calls, specialists } = recorder();
  const r = await handleMessage(MSG, {
    classify: classifyAs("order_status"),
    plan: async () => {
      throw new Error("planner down");
    },
    specialists,
  });
  assert.equal(r.outcome, "resolved");
  assert.deepEqual(calls, [MSG]);
});
