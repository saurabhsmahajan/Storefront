export const WINDOW_DAYS = 30;

const money = (o) => `${(o.total_minor / 100).toFixed(2)} ${o.currency}`;
const ok = (e, type) =>
  e.some((x) => x.event_type === type && x.payload?.success === "true");

// Pure function: decides refund eligibility from facts. No I/O, no model.
// verdicts: eligible, not_eligible, no_rule (policy does not cover it: escalate)
export function decideEligibility({ order, events = [], now = Date.now() }) {
  if (!order) return { verdict: "not_found" };
  const age_days = Math.floor((now - new Date(order.created_at)) / 86400000);
  const captured = ok(events, "CAPTURE");
  const refund_recorded = ok(events, "REFUND");
  const authorised = ok(events, "AUTHORISATION");
  const cancellation_recorded = ok(events, "CANCELLATION");
  const facts = {
    status: order.status,
    total: money(order),
    age_days,
    authorised,
    captured,
    cancellation_recorded,
    refund_recorded,
  };
  const out = (verdict, reason) => ({ verdict, reason, facts });

  switch (order.status) {
    case "refunded":
      return out("not_eligible", "already_refunded");
    case "pending":
      // A captured payment on a pending order means the customer was charged.
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
