import test from "node:test";
import assert from "node:assert/strict";
import { runPlan } from "./run-plan.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Stub specialist: waits, then returns what it was given.
const stub = (ms) => async (input) => {
  await sleep(ms);
  return { reply: `done: ${input}` };
};
const jobs3 = [
  { id: "s1", specialist: "order_status", input: "a" },
  { id: "s2", specialist: "decline", input: "b" },
  { id: "s3", specialist: "refund", input: "c" },
];
const three = (ms) => ({
  order_status: stub(ms),
  decline: stub(ms),
  refund: stub(ms),
});
const timed = async (jobs, opts) => {
  const t = Date.now();
  const results = await runPlan(jobs, opts);
  return { results, total: Date.now() - t };
};

test("1. three independent 300 ms jobs run in parallel", async () => {
  const { results, total } = await timed(jobs3, { specialists: three(300) });
  assert.ok(total < 600, `total ${total} ms`);
  assert.ok(results.every((r) => r.status === "answered"));
  const latestStart = Math.max(...results.map((r) => r.startMs));
  const earliestEnd = Math.min(...results.map((r) => r.endMs));
  assert.ok(latestStart < earliestEnd, "intervals overlap");
});

test("2. concurrency 1 runs one after another in job order", async () => {
  const { results, total } = await timed(jobs3, {
    specialists: three(300),
    concurrency: 1,
  });
  assert.ok(total >= 850, `total ${total} ms`);
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i].startMs >= results[i - 1].endMs, `job ${i}`);
  }
});

test("3. concurrency 2 with three 300 ms jobs takes two rounds", async () => {
  const { results, total } = await timed(jobs3, {
    specialists: three(300),
    concurrency: 2,
  });
  assert.ok(total >= 550 && total <= 900, `total ${total} ms`);
  assert.ok(results.every((r) => r.status === "answered"));
});

test("4. results keep job order when a later job finishes first", async () => {
  const results = await runPlan(jobs3, {
    specialists: {
      order_status: stub(250),
      decline: stub(150),
      refund: stub(20),
    },
  });
  assert.deepEqual(
    results.map((r) => r.id),
    ["s1", "s2", "s3"],
  );
  assert.ok(results[2].endMs < results[0].endMs);
  assert.deepEqual(results[0].r, { reply: "done: a" });
});

const failing = async (specialistFn) => {
  const results = await runPlan(jobs3, {
    specialists: { ...three(50), decline: specialistFn },
  });
  assert.equal(results[0].status, "answered");
  assert.equal(results[2].status, "answered");
  assert.equal(results[1].status, "failed");
  assert.equal(results[1].r, null);
  assert.equal(results[1].error, "boom");
  assert.equal(results[0].error, null);
};

test("5. a stub that throws in an async function fails alone", async () => {
  await failing(async () => {
    await sleep(10);
    throw new Error("boom");
  });
});

test("6. a stub that throws synchronously fails alone", async () => {
  await failing(() => {
    throw new Error("boom");
  });
});

test("7. a stub that returns a rejected promise fails alone", async () => {
  await failing(() => Promise.reject(new Error("boom")));
});

test("8. a timeout fails its job after about timeoutMs; others still answer", async () => {
  const { results, total } = await timed(
    [
      { id: "slow", specialist: "decline", input: "x" },
      { id: "fast", specialist: "refund", input: "y" },
    ],
    { specialists: { decline: stub(500), refund: stub(20) }, timeoutMs: 100 },
  );
  assert.ok(total < 300, `total ${total} ms`);
  assert.equal(results[0].status, "failed");
  assert.equal(results[0].error, "timeout");
  assert.equal(results[0].r, null);
  assert.ok(results[0].endMs >= 90 && results[0].endMs < 300);
  assert.equal(results[1].status, "answered");
});

test("9. a result that arrives after the timeout changes nothing", async () => {
  let arrived = false;
  const late = async () => {
    await sleep(200);
    arrived = true;
    return { reply: "too late" };
  };
  const results = await runPlan(
    [{ id: "s1", specialist: "refund", input: "x" }],
    { specialists: { refund: late }, timeoutMs: 50 },
  );
  const before = structuredClone(results);
  await sleep(300);
  assert.equal(arrived, true);
  assert.deepEqual(results, before);
  assert.equal(results[0].status, "failed");
  assert.equal(results[0].error, "timeout");
});

test("10. an unknown specialist fails without calling anything", async () => {
  let calls = 0;
  const spy = async () => {
    calls++;
    return {};
  };
  const results = await runPlan(
    [
      { id: "s1", specialist: "billing", input: "x" },
      { id: "s2", specialist: "toString", input: "x" },
    ],
    { specialists: { refund: spy } },
  );
  assert.equal(calls, 0);
  for (const r of results) {
    assert.equal(r.status, "failed");
    assert.equal(r.r, null);
    assert.match(r.error, /unknown specialist/);
  }
});

test("11. the stub receives exactly the input string and nothing else", async () => {
  const input = `  Where is order 5eed0000-0000-4000-8000-000000000103 ?\t\n\nOrder ID:  x  `;
  let seen;
  const results = await runPlan([{ id: "s1", specialist: "refund", input }], {
    specialists: {
      refund: async (...args) => {
        seen = args;
        return { ok: true };
      },
    },
  });
  assert.equal(seen.length, 1);
  assert.equal(seen[0], input);
  assert.equal(results[0].status, "answered");
});

test("12. an empty jobs array resolves to []", async () => {
  assert.deepEqual(await runPlan([], { specialists: {} }), []);
});
