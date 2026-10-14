# Week 3 step D: close-out (2026-10-14)

## Result
The `storefront-mcp` Edge Function is deployed to the real project and answers the three tools. Live evidence: `week-3-mcp-server-calls-live-2026-10-14.md`.

| Check | Live result |
|---|---|
| `get_order` on the test customer's order | paid, 5 days old |
| `get_payment_status` | 2 attempts: first declined with the plain-tier 3D Secure text, second approved. No raw payment field shown |
| `check_refund_eligibility` | eligible, within_window, recommendation only |
| Missing/short order ID | `invalid_input`, not retryable |
| Order ID that does not exist | `not_found` |
| No token | `unauthorized` |

## What went wrong on the way (kept on purpose)
- The first live run returned `upstream_unavailable` for both payment tools. The three function secrets had been set to empty values by a PowerShell block that read nothing from `.env`. `supabase secrets list` showed all three with the digest of an empty string. A Node script (`agents/mcp/set-function-secrets.mjs`) now sets them and refuses to run if any value is missing.
- The function now logs why a payment read failed (no secrets in the log line).

## Test data in the real project
One customer `mcp-test-customer@storefront.test` and one order `5eed0000-0000-4000-8000-0000000001a1` with three payment events marked "step D MCP test data". Created by hand in the dashboard. Remove with:

```sql
delete from public.payment_events where order_id = '5eed0000-0000-4000-8000-0000000001a1';
delete from public.orders where id = '5eed0000-0000-4000-8000-0000000001a1';
```
then delete the user in Authentication, Users.

## Not proven yet
- A real order that belongs to a different customer returning `not_found`. The first live run used a random ID. The evidence client now takes `ORDER_OTHER` for this; run it and add the result.
- `upstream_unavailable` and `internal` were only tested with fakes (unit tests), not live.
- The one-order scoping of payment reads is done in function code, not by row-level security (see the design note).
- The refund rules and the decline reasons file exist twice (agents and function). Tests fail if they drift, but a drift is still possible between a test run and a deploy.
