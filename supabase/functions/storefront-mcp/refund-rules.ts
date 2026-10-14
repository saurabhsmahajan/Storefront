// Same decision rules as agents/lib/refund-rules.mjs (kept equal by a parity test).
export const WINDOW_DAYS = 30;

export type OrderRow = {
  id: string;
  status: string;
  currency: string;
  total_minor: number;
  created_at: string;
};
export type EventRow = { event_type: string; payload: Record<string, unknown> };

const ok = (e: EventRow[], type: string) =>
  e.some((x) => x.event_type === type && x.payload?.success === "true");

export function decideEligibility(
  order: OrderRow,
  events: EventRow[],
  now: number,
) {
  const age_days = Math.floor(
    (now - new Date(order.created_at).getTime()) / 86400000,
  );
  const captured = ok(events, "CAPTURE");
  const refund_recorded = ok(events, "REFUND");
  const out = (verdict: string, reason: string) => ({
    verdict,
    reason,
    status: order.status,
    age_days,
  });
  switch (order.status) {
    case "refunded":
      return out("not_eligible", "already_refunded");
    case "pending":
      return captured
        ? out("no_rule", "pending_with_capture")
        : out("not_eligible", "never_paid");
    case "paid":
      if (refund_recorded) return out("no_rule", "inconsistent_records");
      if (!captured) return out("no_rule", "paid_without_capture");
      return age_days > WINDOW_DAYS
        ? out("not_eligible", "outside_window")
        : out("eligible", "within_window");
    case "cancelled":
      return out("no_rule", "cancelled_order");
    default:
      return out("no_rule", "status_not_covered");
  }
}
