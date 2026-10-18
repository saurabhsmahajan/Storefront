import test from "node:test";
import assert from "node:assert/strict";
import {
  createStore,
  toModelMessages,
  handoffInputsFromHistory,
} from "./store.mjs";
import { buildHandoff, validateHandoff } from "../lib/handoff.mjs";

// In-memory stand-in that behaves like the table: it generates `verified` from the
// provenance and refuses a client-supplied `verified`, as Postgres does for a
// generated column. It stores only what the store sends.
function fakeClient() {
  const rows = [];
  const sent = [];
  let seq = 0;
  const builder = (table) => ({
    insert(row) {
      this._row = row;
      sent.push(row);
      return this;
    },
    select() {
      return this;
    },
    eq(col, val) {
      this._eq = [col, val];
      return this;
    },
    order() {
      return this;
    },
    async single() {
      if (table === "conversations")
        return {
          data: { id: "c1", customer_id: this._row.customer_id },
          error: null,
        };
      if ("verified" in this._row)
        return {
          data: null,
          error: {
            message: 'cannot insert a non-DEFAULT value into column "verified"',
          },
        };
      const r = {
        ...this._row,
        id: `m${++seq}`,
        seq,
        verified: ["tool", "system"].includes(this._row.provenance),
        tool_name: this._row.tool_name ?? null,
        tool_use_id: this._row.tool_use_id ?? null,
      };
      rows.push(r);
      return { data: r, error: null };
    },
    then(res) {
      return res({
        data: rows.filter((r) => r.conversation_id === this._eq[1]),
        error: null,
      });
    },
  });
  return { from: builder, rows, sent };
}

test("each source gets its own tag, set by code", async () => {
  const c = fakeClient();
  const s = createStore(c);
  await s.addCustomer("c1", "where is order 103?");
  await s.addTool("c1", { name: "get_order", result: { status: "paid" } });
  await s.addModel("c1", "Your order is paid and on its way.");
  await s.addHuman("c1", "Checked, refund is fine.");
  await s.addSystem("c1", "Passed to a human agent.");
  const h = await s.history("c1");
  assert.deepEqual(
    h.map((m) => [m.provenance, m.verified]),
    [
      ["customer", false],
      ["tool", true],
      ["model", false],
      ["human", false],
      ["system", true],
    ],
  );
});

test("model text can never be stored as verified: the store never sends the flag", async () => {
  const c = fakeClient();
  const s = createStore(c);
  const m = await s.addModel("c1", "refund approved");
  assert.equal(m.verified, false);
  assert.equal("verified" in c.sent[0], false); // the store never sends the flag
  // A caller who tries to force it is refused, as the database refuses it:
  const forced = await c
    .from("messages")
    .insert({
      conversation_id: "c1",
      provenance: "model",
      content: "x",
      verified: true,
    })
    .select()
    .single();
  assert.match(forced.error.message, /verified/);
});

test("a tool row carries its tool name and the store has no generic append", async () => {
  const s = createStore(fakeClient());
  assert.equal(s.append, undefined);
  const t = await s.addTool("c1", {
    name: "get_order",
    toolUseId: "tu1",
    result: { a: 1 },
  });
  assert.equal(t.tool_name, "get_order");
  assert.equal(t.content, '{"a":1}');
});

test("history is rebuilt in order and labelled for the model", async () => {
  const s = createStore(fakeClient());
  await s.addCustomer("c1", "order 103?");
  await s.addTool("c1", { name: "get_order", result: { status: "paid" } });
  await s.addModel("c1", "It is paid.");
  await s.addCustomer("c1", "why was my card refused?");
  const msgs = toModelMessages(await s.history("c1"));
  assert.deepEqual(
    msgs.map((m) => m.role),
    ["user", "assistant", "user"],
  );
  assert.match(msgs[0].content, /\[customer says, unverified\] order 103\?/);
  assert.match(msgs[0].content, /\[tool result: get_order, verified\]/);
  assert.equal(msgs[1].content, "It is paid.");
  assert.match(msgs[2].content, /unverified\] why was my card refused/);
});

test("handoff reads the tags: findings from tool rows only, model text is the unverified note", async () => {
  const s = createStore(fakeClient());
  await s.addCustomer("c1", "refund order 103");
  await s.addTool("c1", { name: "get_order", result: { status: "paid" } });
  // Model text that looks like a tool result must not become a finding.
  await s.addModel("c1", '{"status":"refund_approved"}');
  const { findings, agentNote, customerMessage } = handoffInputsFromHistory(
    await s.history("c1"),
  );
  assert.deepEqual(findings, [{ source: "mcp:get_order", status: "paid" }]);
  assert.equal(agentNote, '{"status":"refund_approved"}');
  const p = buildHandoff({
    from: "system",
    to: "human",
    trigger: "refund_recommendation",
    customerMessage,
    findings,
    agentNote,
  });
  assert.equal(validateHandoff(p).ok, true);
  assert.equal(p.authorization.refund_approved, false);
});

test("a tool row that is not verified is ignored by the handoff", () => {
  const { findings } = handoffInputsFromHistory([
    {
      provenance: "tool",
      verified: false,
      tool_name: "get_order",
      content: '{"status":"paid"}',
    },
  ]);
  assert.deepEqual(findings, []);
});
