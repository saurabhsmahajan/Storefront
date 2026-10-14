import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { load } from "./load-function.mjs";
const { callTool, TOOLS, explain } = await load("tools.ts");
const { decideEligibility: fnDecide } = await load("refund-rules.ts");
import { decideEligibility } from "../lib/refund-rules.mjs";

const NOW = Date.parse("2026-10-06T12:00:00Z");
const ID = "5eed0000-0000-4000-8000-000000000101";
const order = (status = "paid", days = 5) => ({
  id: ID,
  status,
  currency: "INR",
  total_minor: 159900,
  created_at: new Date(NOW - days * 86400000).toISOString(),
});
const ev = (event_type, payload) => ({ event_type, payload });
function ctx({
  user = "u1",
  ord = order(),
  events = [],
  failDb = false,
  broken = false,
} = {}) {
  const asked = [];
  return {
    asked,
    userId: async () => user,
    now: () =>
      broken
        ? (() => {
            throw new Error("secret stack detail");
          })()
        : NOW,
    db: {
      getOwnOrder: async () => {
        if (failDb) throw new Error("connection string leaked");
        return ord;
      },
      getPaymentEvents: async (_id, as) => {
        asked.push(as);
        return events;
      },
    },
  };
}
const call = (c, name, input) => callTool(c, name, input);

test("tool list: three tools, each with a Use for and a Not for line", () => {
  assert.deepEqual(
    TOOLS.map((t) => t.name),
    ["get_order", "get_payment_status", "check_refund_eligibility"],
  );
  for (const t of TOOLS) {
    assert.match(t.description, /Use for:/);
    assert.match(t.description, /Not for:/);
    assert.deepEqual(t.inputSchema.required, ["order_id"]);
  }
  assert.ok(!TOOLS.some((t) => t.name === "execute_refund"));
});

test("get_order returns only its allowed fields", async () => {
  const r = await call(ctx(), "get_order", { order_id: ID });
  assert.equal(r.isError, false);
  assert.deepEqual(Object.keys(r.body).sort(), [
    "age_days",
    "currency",
    "order_id",
    "ordered_at",
    "status",
    "total_minor",
  ]);
  assert.equal(r.body.age_days, 5);
});

test("get_order never touches payment events", async () => {
  const c = ctx();
  await call(c, "get_order", { order_id: ID });
  assert.deepEqual(c.asked, []);
});

test("get_payment_status: attempts and tiered reasons, no raw fields", async () => {
  const events = [
    ev("AUTHORISATION", {
      success: "false",
      reason: "FRAUD",
      cardSummary: "1234",
      authCode: "9XZ",
    }),
    ev("AUTHORISATION", {
      success: "false",
      reason: "3D Not Authenticated",
      expiryDate: "03/2030",
    }),
    ev("AUTHORISATION", { success: "false", reason: "Some New Reason" }),
    ev("AUTHORISATION", { success: "true", authCode: "ABC123" }),
    ev("CAPTURE", { success: "true" }),
  ];
  const c = ctx({ events });
  const r = await call(c, "get_payment_status", { order_id: ID });
  assert.equal(r.body.attempt_count, 4);
  assert.equal(r.body.attempts[3].outcome, "approved");
  assert.equal(r.body.attempts[1].explanation, explain("3D Not Authenticated"));
  assert.equal(r.body.attempts[0].explanation, explain("Some New Reason"));
  const text = JSON.stringify(r.body);
  for (const leak of [
    "FRAUD",
    "1234",
    "9XZ",
    "03/2030",
    "ABC123",
    "cardSummary",
    "payload",
  ]) {
    assert.ok(!text.includes(leak), `leaked ${leak}`);
  }
  assert.deepEqual(c.asked, ["get_payment_status"]);
});

test("disclosure tiers: plain shows text, category and never_tell and unknown show generic text", () => {
  const m = JSON.parse(
    fs.readFileSync(new URL("../data/decline-reasons.json", import.meta.url)),
  );
  assert.equal(
    explain("3D Not Authenticated"),
    m.reasons["3D Not Authenticated"].text,
  );
  assert.equal(explain("Expired Card"), m.tiers.category);
  assert.equal(explain("FRAUD"), m.tiers.never_tell);
  assert.equal(explain("never seen"), m.tiers.never_tell);
  assert.equal(explain(undefined), m.tiers.never_tell);
});

test("the copy of decline-reasons.json equals the agents one", () => {
  const a = fs.readFileSync(
    new URL("../data/decline-reasons.json", import.meta.url),
    "utf8",
  );
  const b = fs.readFileSync(
    new URL(
      "../../supabase/functions/storefront-mcp/decline-reasons.json",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(a, b);
});

test("check_refund_eligibility: recommends only, uses the refund principal", async () => {
  const c = ctx({
    events: [
      ev("AUTHORISATION", { success: "true" }),
      ev("CAPTURE", { success: "true" }),
    ],
  });
  const r = await call(c, "check_refund_eligibility", { order_id: ID });
  assert.equal(r.body.verdict, "eligible");
  assert.equal(r.body.reason, "within_window");
  assert.equal(r.body.recommendation_only, true);
  assert.deepEqual(r.body.facts, {
    status: "paid",
    age_days: 5,
    window_days: 30,
    within_window: true,
  });
  assert.deepEqual(c.asked, ["check_refund_eligibility"]);
});

test("refund rules in the function equal the agents rules on every case", () => {
  const cap = [
    ev("AUTHORISATION", { success: "true" }),
    ev("CAPTURE", { success: "true" }),
  ];
  const cases = [];
  for (const status of [
    "pending",
    "paid",
    "fulfilled",
    "cancelled",
    "refunded",
  ]) {
    for (const days of [0, 30, 31, 90]) {
      for (const events of [
        [],
        cap,
        [...cap, ev("REFUND", { success: "true" })],
      ]) {
        cases.push({ status, days, events });
      }
    }
  }
  for (const k of cases) {
    const o = order(k.status, k.days);
    const a = decideEligibility({ order: o, events: k.events, now: NOW });
    const b = fnDecide(o, k.events, NOW);
    assert.equal(b.verdict, a.verdict, JSON.stringify(k));
    assert.equal(b.reason, a.reason, JSON.stringify(k));
  }
});

test("errors: invalid input", async () => {
  for (const input of [
    undefined,
    {},
    { order_id: 5 },
    { order_id: "101" },
    { order_id: ID + "x" },
  ]) {
    const r = await call(ctx(), "get_order", input);
    assert.equal(r.isError, true);
    assert.equal(r.body.error.type, "invalid_input");
    assert.equal(r.body.error.retryable, false);
  }
});

test("errors: unauthorized, and no data is read first", async () => {
  const c = ctx({ user: null });
  const r = await call(c, "get_payment_status", { order_id: ID });
  assert.equal(r.body.error.type, "unauthorized");
  assert.deepEqual(c.asked, []);
});

test("errors: someone else's order looks the same as a missing order, and payments are not read", async () => {
  const c = ctx({ ord: null });
  const r = await call(c, "get_payment_status", { order_id: ID });
  assert.equal(r.body.error.type, "not_found");
  assert.deepEqual(c.asked, []);
});

test("errors: data store failure is retryable and leaks nothing", async () => {
  const r = await call(ctx({ failDb: true }), "get_order", { order_id: ID });
  assert.equal(r.body.error.type, "upstream_unavailable");
  assert.equal(r.body.error.retryable, true);
  assert.ok(!JSON.stringify(r.body).includes("connection string"));
});

test("errors: an unexpected bug becomes internal and leaks nothing", async () => {
  const r = await call(ctx({ broken: true }), "get_order", { order_id: ID });
  assert.equal(r.body.error.type, "internal");
  assert.ok(!JSON.stringify(r.body).includes("secret stack"));
});

test("every error has type, message, retryable and next_action", async () => {
  const kinds = [
    call(ctx(), "get_order", {}),
    call(ctx({ user: null }), "get_order", { order_id: ID }),
    call(ctx({ ord: null }), "get_order", { order_id: ID }),
    call(ctx({ failDb: true }), "get_order", { order_id: ID }),
    call(ctx({ broken: true }), "get_order", { order_id: ID }),
    call(ctx(), "execute_refund", { order_id: ID }),
  ];
  for (const r of await Promise.all(kinds)) {
    assert.equal(r.isError, true);
    const e = r.body.error;
    assert.ok(
      e.type && e.message && typeof e.retryable === "boolean" && e.next_action,
    );
  }
});

test("over MCP: a client sees the three tools and gets structured errors back", async () => {
  const { createMcpServer } = await load("server.ts");
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { InMemoryTransport } =
    await import("@modelcontextprotocol/sdk/inMemory.js");
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createMcpServer(ctx()).connect(b);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(a);
  const list = await client.listTools();
  assert.deepEqual(
    list.tools.map((t) => t.name),
    ["get_order", "get_payment_status", "check_refund_eligibility"],
  );
  const ok = await client.callTool({
    name: "get_order",
    arguments: { order_id: ID },
  });
  assert.equal(ok.isError, false);
  assert.equal(JSON.parse(ok.content[0].text).status, "paid");
  const bad = await client.callTool({ name: "get_order", arguments: {} });
  assert.equal(bad.isError, true);
  assert.equal(JSON.parse(bad.content[0].text).error.type, "invalid_input");
  await client.close();
});
