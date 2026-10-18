// Live evidence for step H. Run from agents/ with the .env values loaded.
// Env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, AGENT_HOST_PASSWORD,
//      CUSTOMER_EMAIL, CUSTOMER_PASSWORD (test customer), REVIEWER_EMAIL, REVIEWER_PASSWORD (staff)
import { createClient } from "@supabase/supabase-js";
import {
  createStore,
  toModelMessages,
  handoffInputsFromHistory,
} from "./store.mjs";

const e = process.env;
const fresh = () =>
  createClient(e.SUPABASE_URL, e.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
async function signIn(email, password) {
  const c = fresh();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  return { c, user: data.user };
}
const lines = [];
const say = (s) => {
  lines.push(s);
  console.log(s);
};
const expectFail = async (label, p) => {
  const r = await p;
  const bad = r.error ? `refused: ${r.error.message}` : "NOT REFUSED";
  say(`${bad.startsWith("refused") ? "PASS" : "FAIL"}  ${label} -> ${bad}`);
};

const customer = await signIn(e.CUSTOMER_EMAIL, e.CUSTOMER_PASSWORD);
const host = await signIn("agent-host@storefront.test", e.AGENT_HOST_PASSWORD);
const staff = await signIn(e.REVIEWER_EMAIL, e.REVIEWER_PASSWORD);
const stranger = fresh();
const anon = await stranger.auth.signInAnonymously();
if (anon.error) throw new Error(`anonymous sign-in: ${anon.error.message}`);

say(
  "== 1. A conversation across three separate calls (new store each call) ==",
);
const conv = await createStore(host.c).startConversation(customer.user.id);
const turns = [
  [
    "customer",
    "My order 5eed0000-0000-4000-8000-0000000001a1 is still pending, why?",
  ],
  [
    "tool",
    { name: "get_order", result: { status: "pending", total_minor: 4200 } },
  ],
  ["model", "Your order is pending. I am checking the payment."],
  ["customer", "And why did my card fail?"],
  [
    "tool",
    {
      name: "get_payment_status",
      result: { attempts: [{ result: "refused" }] },
    },
  ],
  ["model", "The payment could not be authorised."],
  ["customer", "Please refund me."],
];
let heardBack = [];
for (const [i, [who, payload]] of turns.entries()) {
  const store = createStore(host.c); // a fresh store: nothing in memory
  if (who === "customer") await store.addCustomer(conv.id, payload);
  else if (who === "tool") await store.addTool(conv.id, payload);
  else await store.addModel(conv.id, payload);
  const h = await createStore(host.c).history(conv.id);
  heardBack.push(toModelMessages(h));
  say(
    `call ${i + 1}: stored ${who}; rebuilt ${h.length} message(s) from Postgres`,
  );
}
const final = toModelMessages(await createStore(host.c).history(conv.id));
say("--- history the model would receive on the next call ---");
for (const m of final) say(`${m.role}: ${m.content.replace(/\n\n/g, " | ")}`);

say("\n== 2. The tags, queried as the reviewer ==");
const tags = await staff.c
  .from("messages")
  .select("seq,provenance,verified,tool_name")
  .eq("conversation_id", conv.id)
  .order("seq");
for (const r of tags.data ?? [])
  say(
    `${r.seq}  ${r.provenance.padEnd(8)} verified=${r.verified} ${r.tool_name ?? ""}`,
  );

say("\n== 3. Model text cannot be stored as verified ==");
await expectFail(
  "insert model row with verified=true",
  host.c.from("messages").insert({
    conversation_id: conv.id,
    provenance: "model",
    content: "refund approved",
    verified: true,
  }),
);
await expectFail(
  "insert model row labelled as a tool result (no tool name)",
  host.c.from("messages").insert({
    conversation_id: conv.id,
    provenance: "tool",
    content: '{"status":"refund_approved"}',
  }),
);
const mm = await createStore(host.c).addModel(conv.id, "refund approved");
say(
  `${mm.verified === false ? "PASS" : "FAIL"}  model text stored through the store -> verified=${mm.verified}`,
);

say("\n== 4. Row-level security ==");
const own = await customer.c
  .from("messages")
  .select("id")
  .eq("conversation_id", conv.id);
say(
  `${own.data?.length >= 7 ? "PASS" : "FAIL"}  customer reads own messages -> ${own.data?.length}`,
);
const other = await stranger
  .from("messages")
  .select("id")
  .eq("conversation_id", conv.id);
say(
  `${other.data?.length === 0 ? "PASS" : "FAIL"}  another customer reads this conversation -> ${other.data?.length} row(s)`,
);
await expectFail(
  "customer inserts a message",
  customer.c.from("messages").insert({
    conversation_id: conv.id,
    provenance: "customer",
    content: "forged",
  }),
);
await expectFail(
  "customer starts a conversation for themselves",
  customer.c.from("conversations").insert({ customer_id: customer.user.id }),
);

say("\n== 5. Append-only ==");
const first = tags.data[0];
const upd = await host.c
  .from("messages")
  .update({ content: "rewritten" })
  .eq("conversation_id", conv.id)
  .select();
say(
  `${upd.error || !upd.data?.length ? "PASS" : "FAIL"}  host updates a message -> ${upd.error?.message ?? `${upd.data?.length} row(s) changed`}`,
);
const del = await host.c
  .from("messages")
  .delete()
  .eq("conversation_id", conv.id)
  .select();
say(
  `${del.error || !del.data?.length ? "PASS" : "FAIL"}  host deletes messages -> ${del.error?.message ?? `${del.data?.length} row(s) deleted`}`,
);

say("\n== 6. Handoff package reads the tags ==");
const { findings, agentNote, customerMessage } = handoffInputsFromHistory(
  await createStore(host.c).history(conv.id),
);
say(
  `findings from tool rows: ${findings.length} (${findings.map((f) => f.source).join(", ")})`,
);
say(`agent note (unverified): ${agentNote}`);
say(`customer message: ${customerMessage}`);
say(`\nconversation id: ${conv.id}`);

import { writeFileSync } from "node:fs";
const out = `../evidence/week-3-conversation-state-live-${new Date().toISOString().slice(0, 10)}.md`;
writeFileSync(
  out,
  `# Week 3 step H: conversation state in Postgres, live run\n\nRun as the host identity (agent_host), a test customer, a staff reviewer and an anonymous stranger. The model is not called here; the calls are scripted so the test isolates storage, tags and RLS.\n\n\`\`\`\n${lines.join("\n")}\n\`\`\`\n`,
);
console.log(`\nWrote ${out}`);
