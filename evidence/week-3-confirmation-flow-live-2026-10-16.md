# Week 3 step G: confirmation flow (2026-10-16)

Data source: real, reviewer reviewer@storefront.test
Package: message-11-refund_recommendation.json, trigger refund_recommendation, order 5eed0000-0000-4000-8000-000000000103

1. Stub `execute_refund` before any confirmation: DENIED. Blocked: execute_refund for order 5eed0000-0000-4000-8000-000000000103 needs approval from a human agent, and none has been recorded. Escalate to a human instead.

2. Package opened. Can approve: true. Records digest 8cff610cc531. Payment events shown: 2.

3. Confirm without the tick: refused (not_acknowledged)

4. Confirm with a digest that does not match the records: refused (stale)

5. Stub call after the refusals: DENIED. Blocked: execute_refund for order 5eed0000-0000-4000-8000-000000000103 needs approval from a human agent, and none has been recorded. Escalate to a human instead.

6. Reviewer confirms with the tick and the real digest: approved by reviewer@storefront.test, expires 2026-10-16T09:31:44.680Z

7. Stub call after confirmation: allowed

8. Stub ran (no money moved). Approval is spent. Stub call again: DENIED. Blocked: execute_refund for order 5eed0000-0000-4000-8000-000000000103 needs approval from a human agent, and none has been recorded. Escalate to a human instead.

Approval record:

```json
[
 {
  "order_id": "5eed0000-0000-4000-8000-000000000103",
  "approved_by": "reviewer@storefront.test",
  "approved_at": "2026-10-16T09:01:44.680Z",
  "expires_at": "2026-10-16T09:31:44.680Z",
  "package_sha256": "dee36c8760068b10c68e08533e09eea6134843bba3c90df8e8fe4cd9631f5efc",
  "view_digest": "8cff610cc5312dfc14717dd42a9d066318da0ab0dad00df66746f11e92936d59",
  "consumed": true,
  "consumed_at": "2026-10-16T09:01:44.696Z"
 }
]
```
