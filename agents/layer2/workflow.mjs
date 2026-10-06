import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { MODEL } from "../config.mjs";
import { classifyIntent } from "./classify.mjs";
import { getOrder, getPayments } from "../lib/db.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(p, "utf8").trim();
const WRITER_PROMPT =
  read(path.join(here, "writer-prompt.txt")) +
  "\n\n" +
  read(path.join(here, "..", "data", "refund-policy.txt"));

const client = new Anthropic();
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Fixed routing table. Code decides the lookup and the credential, not the model.
const ROUTES = {
  order_status: {
    role: "order_status",
    run: (id) => getOrder(id, "order_status"),
  },
  decline: {
    role: "decline",
    run: async (id) => {
      const events = await getPayments(id, "decline");
      return events.map((e) => ({
        event: e.event_type,
        success: e.payload?.success,
        reason: e.payload?.reason,
        date: e.received_at,
      }));
    },
  },
  refund: {
    role: "refund",
    run: async (id) => {
      const order = await getOrder(id, "refund");
      if (!order) return null;
      const ageDays = Math.floor(
        (Date.now() - new Date(order.created_at)) / 86400000,
      );
      return { ...order, age_days: ageDays };
    },
  },
};

export async function handle(message) {
  const trace = {};
  const { intent, raw } = await classifyIntent(message);
  trace.intent = intent ?? `INVALID:${raw}`;
  const orderId = message.match(UUID)?.[0] ?? null;
  trace.orderId = orderId;

  let lookup = { status: "not_run" };
  const escalate = intent === "human_request";
  const route = ROUTES[intent];
  if (route) {
    if (!orderId) {
      lookup = { status: "no_order_id" };
    } else {
      trace.credential = route.role;
      try {
        const data = await route.run(orderId);
        const isEmpty = data == null || (Array.isArray(data) && !data.length);
        lookup = isEmpty ? { status: "empty" } : { status: "ok", data };
      } catch (err) {
        lookup = { status: "error", message: err.message };
      }
    }
  }
  trace.lookup = lookup;
  trace.escalate = escalate;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: WRITER_PROMPT,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          customer_message: message,
          intent: intent ?? "unknown",
          order_id: orderId,
          escalate,
          lookup,
        }),
      },
    ],
  });
  const reply = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return { reply, stop: res.stop_reason, trace };
}
