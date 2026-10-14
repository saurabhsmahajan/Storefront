import mapping from "./decline-reasons.json" with { type: "json" };
import { errorBody, ToolFailure } from "./errors.ts";
import { decideEligibility, WINDOW_DAYS } from "./refund-rules.ts";
import type { EventRow, OrderRow } from "./refund-rules.ts";

// What each tool is allowed to touch. The real implementation is in index.ts.
export interface Db {
  // Customer credential: the signed-in customer's own order, or null.
  getOwnOrder(userId: string, orderId: string): Promise<OrderRow | null>;
  // Policy-scoped specialist credential. The caller has already proved ownership.
  getPaymentEvents(
    orderId: string,
    as: "get_payment_status" | "check_refund_eligibility",
  ): Promise<EventRow[]>;
}
export interface Ctx {
  userId(): Promise<string | null>;
  db: Db;
  now(): number;
}

const FULL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const TOOLS = [
  {
    name: "get_order",
    description:
      "Look up one order that belongs to the signed-in customer and return its status, total, currency, order date and age in days. " +
      "Use for: 'Where is my order 5eed0000-0000-4000-8000-000000000101?' or 'What did I pay for this order?'. " +
      "Not for: why a payment failed or how many payment attempts there were (use get_payment_status), and not for deciding whether the customer can get a refund (use check_refund_eligibility). It never returns payment details.",
    inputSchema: ORDER_ID_SCHEMA(),
  },
  {
    name: "get_payment_status",
    description:
      "For one order that belongs to the signed-in customer, return how many payment attempts were made and, for each declined attempt, a customer-safe reason. " +
      "Use for: 'Why was my card declined on order 5eed0000-0000-4000-8000-000000000102?' or 'How many times did the payment try?'. " +
      "Not for: the order's status, total or date (use get_order), and not for refund questions (use check_refund_eligibility). It never returns raw payment records, card digits or authorisation codes.",
    inputSchema: ORDER_ID_SCHEMA(),
  },
  {
    name: "check_refund_eligibility",
    description:
      "For one order that belongs to the signed-in customer, return a recommendation: eligible, not_eligible or no_rule (policy does not cover it), with a reason code, the order status and age in days against the 30-day window. " +
      "Use for: 'Can I get a refund on order 5eed0000-0000-4000-8000-000000000103?'. " +
      "Not for: approving or making a refund (this tool only recommends and moves no money), and not for order or payment lookups (use get_order or get_payment_status).",
    inputSchema: ORDER_ID_SCHEMA(),
  },
];

function ORDER_ID_SCHEMA() {
  return {
    type: "object",
    properties: {
      order_id: {
        type: "string",
        description:
          "The full order ID (a UUID, 36 characters) from the customer.",
      },
    },
    required: ["order_id"],
    additionalProperties: false,
  };
}

// Applies the disclosure tiers in code. Unknown reasons are never_tell.
export function explain(rawReason: unknown): string {
  const reasons = mapping.reasons as Record<
    string,
    { tier: string; text?: string }
  >;
  const tiers = mapping.tiers as Record<string, string>;
  const entry = typeof rawReason === "string" ? reasons[rawReason] : undefined;
  const tier = entry?.tier ?? mapping.default_tier;
  return tier === "plain" && entry?.text
    ? entry.text
    : tiers[tier === "plain" ? mapping.default_tier : tier];
}

async function db<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch {
    throw new ToolFailure("upstream_unavailable");
  }
}

async function ownedOrder(ctx: Ctx, input: unknown): Promise<OrderRow> {
  const id = (input as { order_id?: unknown } | null)?.order_id;
  if (typeof id !== "string" || !FULL_UUID.test(id))
    throw new ToolFailure("invalid_input");
  const userId = await ctx.userId();
  if (!userId) throw new ToolFailure("unauthorized");
  // Not found and not yours look the same, so a stranger learns nothing.
  const order = await db(ctx.db.getOwnOrder(userId, id));
  if (!order) throw new ToolFailure("not_found");
  return order;
}

const HANDLERS: Record<string, (ctx: Ctx, input: unknown) => Promise<unknown>> =
  {
    async get_order(ctx, input) {
      const o = await ownedOrder(ctx, input);
      return {
        order_id: o.id,
        status: o.status,
        total_minor: o.total_minor,
        currency: o.currency,
        ordered_at: o.created_at,
        age_days: Math.floor(
          (ctx.now() - new Date(o.created_at).getTime()) / 86400000,
        ),
      };
    },
    async get_payment_status(ctx, input) {
      const o = await ownedOrder(ctx, input);
      const events = await db(
        ctx.db.getPaymentEvents(o.id, "get_payment_status"),
      );
      const attempts = events
        .filter((e) => e.event_type === "AUTHORISATION")
        .map((e, i) =>
          e.payload?.success === "true"
            ? { attempt: i + 1, outcome: "approved" }
            : {
                attempt: i + 1,
                outcome: "declined",
                explanation: explain(e.payload?.reason),
              },
        );
      return { order_id: o.id, attempt_count: attempts.length, attempts };
    },
    async check_refund_eligibility(ctx, input) {
      const o = await ownedOrder(ctx, input);
      const events = await db(
        ctx.db.getPaymentEvents(o.id, "check_refund_eligibility"),
      );
      const d = decideEligibility(o, events, ctx.now());
      return {
        order_id: o.id,
        verdict: d.verdict,
        reason: d.reason,
        facts: {
          status: d.status,
          age_days: d.age_days,
          window_days: WINDOW_DAYS,
          within_window: d.age_days <= WINDOW_DAYS,
        },
        recommendation_only: true,
      };
    },
  };

// Every outcome is JSON. A failure is one of the structured errors, never an exception.
export async function callTool(ctx: Ctx, name: string, input: unknown) {
  const handler = HANDLERS[name];
  if (!handler) return { isError: true, body: errorBody("invalid_input") };
  try {
    return { isError: false, body: await handler(ctx, input) };
  } catch (e) {
    const kind = e instanceof ToolFailure ? e.kind : "internal";
    return { isError: true, body: errorBody(kind) };
  }
}
