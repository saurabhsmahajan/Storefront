# Week 3 step B: the three MCP tools and their policies (2026-10-14)

Decided by the project owner. Each tool returns only what its policy allows, reads only rows that belong to the signed-in customer, and never returns a raw payment event. Built in step D.

| Tool | Policy | Reads | Never returns |
|---|---|---|---|
| `get_order` | Status, total, currency, order date and age in days for one order the signed-in customer owns | `orders` (own rows only) | Any payment field, other customers' rows |
| `get_payment_status` | For one order the customer owns: the number of payment attempts and a disclosure-safe reason text for each. Plain and category tiers only; any other reason shows as generic text | `payment_events` through the owning order (own rows only) | A raw payment event, authorisation code, last four digits, expiry, raw refusal reason |
| `check_refund_eligibility` | A verdict, a reason code and the facts behind it (30-day window, order status) for one order the customer owns. Recommends only | `orders` and `payment_events` through the owning order (own rows only) | A raw payment event, any approval of a refund |

## Rules that apply to all three

- The disclosure tiers come from `agents/data/decline-reasons.json`: plain, category and never_tell, and an unknown reason defaults to never_tell.
- No refund-execution tool is exposed to any specialist. A stub `execute_refund` that moves no money is added in step F only to test the PreToolUse hook.
- Errors are structured (error type, retryable flag, suggested next action). A raw exception is never returned (step D).

## Limits

- This is a design decision. Nothing is built or tested yet.
- Customer scoping depends on `orders.user_id`. The scoping for `payment_events` goes through `payment_events.order_id`, which is nullable, so a payment event with no order is not readable by any customer tool.
