# Week 3 step D: MCP server design (2026-10-14)

Function: `supabase/functions/storefront-mcp` (TypeScript on Deno, like the two existing functions). It speaks MCP over HTTP (stateless, one server per request, because each request carries a different customer).

## Credentials per tool

| Tool | Identifies the customer with | Reads data with | Columns it can reach |
|---|---|---|---|
| `get_order` | the caller's token, checked with `auth.getUser` | the caller's own token, so row-level security applies, plus an explicit `user_id` filter | `orders`: id, status, currency, total_minor, created_at |
| `get_payment_status` | same | ownership proved on `orders` with the caller's token, then the decline specialist account reads `payment_events` for that one order | `payment_events`: event_type, payload (only success and reason are used) |
| `check_refund_eligibility` | same | ownership proved the same way, then the refund specialist account reads `payment_events` for that one order | same |

## Why this shape

- Customers have no read policy on `payment_events` (staff and specialist accounts only), so the customer's own token cannot read payments. Adding one would need a migration. The function instead proves ownership with the customer's token and then reads through the specialist account that policy already allows for that tool.
- `get_order` repeats the `user_id` filter in code. Without it, an agent or staff token sent to the function would read any order through the existing agent policies.
- A missing order and someone else's order return the same `not_found`, so a stranger learns nothing.
- The decline reasons file is copied into the function folder, and the refund rules are re-implemented in TypeScript. Tests fail if either drifts from the agents' version.

## Limits

- The specialist accounts are not customer-scoped by row-level security. The one-order, own-customer scoping for payment data is done in the function code. It is tested with fakes, and it has not yet run against the real project.
- The function holds two specialist passwords as secrets, and signs in with them. A leak of the function's environment exposes those two accounts.
- `get_payment_status` counts only `AUTHORISATION` events as attempts.
- A payment event with no `order_id` cannot be reached by any tool (as decided in step B).
- Calls that omit `order_id` are rejected by the function as `invalid_input` because the tool schema is not enforced by the server library; this was tested.
