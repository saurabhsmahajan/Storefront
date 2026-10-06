import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { MODEL } from "../config.mjs";
import { getOrder, getPayments } from "../lib/db.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(p, "utf8").trim();
const SYSTEM =
  read(path.join(here, "system-prompt.txt")) +
  "\n\n" +
  read(path.join(here, "..", "data", "refund-policy.txt"));

const MAX_STEPS = 6;
const MAX_TOKENS_L3 = 4096;
const FALLBACK_REPLY =
  "I'm passing you to a human agent who can help you from here.";
const FULL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ID_SCHEMA = {
  type: "object",
  properties: {
    order_id: {
      type: "string",
      description: "The full order ID (a UUID) from the customer's message",
    },
  },
  required: ["order_id"],
};

const TOOLS = [
  {
    name: "get_order",
    description:
      "Look up one order by its order ID. Returns status, total, currency, order date and age in days. Returns found:false if no such order exists.",
    input_schema: ID_SCHEMA,
  },
  {
    name: "get_payment_events",
    description:
      "List the payment events (authorisation, capture, refund, cancellation) recorded for one order, oldest first. Failed authorisations include the refusal reason. Returns an empty list if there are none.",
    input_schema: ID_SCHEMA,
  },
  {
    name: "escalate_to_human",
    description:
      "Hand the conversation to a human agent. Use when the customer asks for a human or when you cannot resolve the case.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Short reason for the handoff" },
      },
      required: ["reason"],
    },
  },
];

// Read-only tools. The credential is the one that reads both tables.
async function defaultExecute(name, input) {
  const id = input?.order_id;
  if (name === "get_order" || name === "get_payment_events") {
    if (typeof id !== "string" || !FULL_UUID.test(id)) {
      throw new Error("order_id must be a full UUID");
    }
  }
  if (name === "get_order") {
    const o = await getOrder(id, "refund");
    if (!o) return { found: false };
    const age_days = Math.floor(
      (Date.now() - new Date(o.created_at)) / 86400000,
    );
    return { found: true, ...o, age_days };
  }
  if (name === "get_payment_events") {
    const events = await getPayments(id, "refund");
    return {
      events: events.map((e) => ({
        event: e.event_type,
        success: e.payload?.success,
        reason: e.payload?.reason,
        date: e.received_at,
      })),
    };
  }
  throw new Error(`Unknown tool: ${name}`);
}

const client = new Anthropic();

// The loop belongs to this code. It is bounded and every exit returns
// either "resolved" or "escalated".
export async function runAgent(
  message,
  { execute = defaultExecute, maxSteps = MAX_STEPS } = {},
) {
  const messages = [{ role: "user", content: message }];
  const steps = [];
  let escalation = null;

  const finish = (outcome, reply, extra = {}) => ({
    outcome,
    reply,
    steps,
    escalation,
    ...extra,
  });
  const forceEscalate = (reason) => {
    escalation = escalation ?? { reason, by: "code" };
    return finish("escalated", FALLBACK_REPLY, { forced: true });
  };

  for (let step = 1; step <= maxSteps; step++) {
    let res;
    try {
      res = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS_L3,
        system: SYSTEM,
        tools: TOOLS,
        messages,
      });
    } catch (err) {
      steps.push({ step, error: err.message });
      return forceEscalate(`api_error: ${err.message}`);
    }

    // Pass the content back unchanged, including thinking blocks.
    messages.push({ role: "assistant", content: res.content });
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const toolCalls = res.content.filter((b) => b.type === "tool_use");
    const log = {
      step,
      stop: res.stop_reason,
      tools: toolCalls.map((b) => ({ name: b.name, input: b.input })),
    };
    steps.push(log);

    if (res.stop_reason === "end_turn") {
      if (!text) return forceEscalate("empty_final_reply");
      return finish(escalation ? "escalated" : "resolved", text);
    }

    if (res.stop_reason === "tool_use") {
      const results = [];
      for (const block of toolCalls) {
        if (block.name === "escalate_to_human") {
          escalation = {
            reason: String(block.input?.reason ?? "no reason given"),
            by: "model",
          };
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ status: "escalated" }),
          });
          continue;
        }
        try {
          const out = await execute(block.name, block.input);
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(out),
          });
        } catch (err) {
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            is_error: true,
            content: err.message,
          });
        }
      }
      log.results = results.map((r) => ({
        is_error: r.is_error ?? false,
        content: String(r.content).slice(0, 300),
      }));
      messages.push({ role: "user", content: results });
      continue;
    }

    return forceEscalate(`unexpected_stop_reason: ${res.stop_reason}`);
  }
  return forceEscalate("step_cap");
}
