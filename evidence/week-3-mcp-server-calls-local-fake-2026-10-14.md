# Week 3 step D: MCP server calls (2026-10-14)

Target: function run locally under Deno 2.9.6 against a fake Supabase backend (not the real project). Function URL: http://127.0.0.1:8000/

Not shown here: upstream_unavailable and internal. They cannot be provoked on demand; they are covered by unit tests in agents/mcp/storefront-mcp.test.mjs.

## Tool list as the client sees it

```json
[
  {
    "name": "get_order",
    "description": "Look up one order that belongs to the signed-in customer and return its status, total, currency, order date and age in days. Use for: 'Where is my order 5eed0000-0000-4000-8000-000000000101?' or 'What did I pay for this order?'. Not for: why a payment failed or how many payment attempts there were (use get_payment_status), and not for deciding whether the customer can get a refund (use check_refund_eligibility). It never returns payment details.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "order_id": {
          "type": "string",
          "description": "The full order ID (a UUID, 36 characters) from the customer."
        }
      },
      "required": [
        "order_id"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "get_payment_status",
    "description": "For one order that belongs to the signed-in customer, return how many payment attempts were made and, for each declined attempt, a customer-safe reason. Use for: 'Why was my card declined on order 5eed0000-0000-4000-8000-000000000102?' or 'How many times did the payment try?'. Not for: the order's status, total or date (use get_order), and not for refund questions (use check_refund_eligibility). It never returns raw payment records, card digits or authorisation codes.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "order_id": {
          "type": "string",
          "description": "The full order ID (a UUID, 36 characters) from the customer."
        }
      },
      "required": [
        "order_id"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "check_refund_eligibility",
    "description": "For one order that belongs to the signed-in customer, return a recommendation: eligible, not_eligible or no_rule (policy does not cover it), with a reason code, the order status and age in days against the 30-day window. Use for: 'Can I get a refund on order 5eed0000-0000-4000-8000-000000000103?'. Not for: approving or making a refund (this tool only recommends and moves no money), and not for order or payment lookups (use get_order or get_payment_status).",
    "inputSchema": {
      "type": "object",
      "properties": {
        "order_id": {
          "type": "string",
          "description": "The full order ID (a UUID, 36 characters) from the customer."
        }
      },
      "required": [
        "order_id"
      ],
      "additionalProperties": false
    }
  }
]
```

## Calls

### get_order (success)

Arguments:
```json
{
  "order_id": "5eed0000-0000-4000-8000-000000000101"
}
```
isError: false

Result:
```json
{
  "order_id": "5eed0000-0000-4000-8000-000000000101",
  "status": "paid",
  "total_minor": 159900,
  "currency": "INR",
  "ordered_at": "2026-10-09T11:26:37.491Z",
  "age_days": 5
}
```

### get_payment_status (success)

Arguments:
```json
{
  "order_id": "5eed0000-0000-4000-8000-000000000101"
}
```
isError: false

Result:
```json
{
  "order_id": "5eed0000-0000-4000-8000-000000000101",
  "attempt_count": 2,
  "attempts": [
    {
      "attempt": 1,
      "outcome": "declined",
      "explanation": "The payment could not be authorised. Contact your bank or use another payment method. A human agent can look into it."
    },
    {
      "attempt": 2,
      "outcome": "approved"
    }
  ]
}
```

### check_refund_eligibility (success)

Arguments:
```json
{
  "order_id": "5eed0000-0000-4000-8000-000000000101"
}
```
isError: false

Result:
```json
{
  "order_id": "5eed0000-0000-4000-8000-000000000101",
  "verdict": "eligible",
  "reason": "within_window",
  "facts": {
    "status": "paid",
    "age_days": 5,
    "window_days": 30,
    "within_window": true
  },
  "recommendation_only": true
}
```

### get_order (error: invalid_input)

Arguments:
```json
{
  "order_id": "101"
}
```
isError: true

Result:
```json
{
  "error": {
    "type": "invalid_input",
    "message": "The order ID is missing or is not a full order ID.",
    "retryable": false,
    "next_action": "Ask the customer for the full order ID (a UUID, 36 characters), then call the tool again."
  }
}
```

### get_order (error: not_found)

Arguments:
```json
{
  "order_id": "00000000-0000-4000-8000-00000000dead"
}
```
isError: true

Result:
```json
{
  "error": {
    "type": "not_found",
    "message": "No order with that ID was found on this customer's account.",
    "retryable": false,
    "next_action": "Tell the customer no such order was found on their account and ask them to check the ID."
  }
}
```

### get_order with no token (error: unauthorized)

isError: true

```json
{
  "error": {
    "type": "unauthorized",
    "message": "No signed-in customer could be identified for this request.",
    "retryable": false,
    "next_action": "Ask the customer to sign in again. Do not retry."
  }
}
```
