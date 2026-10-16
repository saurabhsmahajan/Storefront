# Week 3 step F: hook transcripts (2026-10-16)

Each step is a tool call passed through the real hook functions in agents/router/hooks.mjs (offline, no model). Tool results are fixtures shaped like the MCP server's output, with sensitive fields added where the redaction hook needs something to remove.

## Hook 1: tool ordering

### 1a. Eligibility before any order lookup

Model calls `mcp__storefront__check_refund_eligibility` with {"order_id":"5eed0000-0000-4000-8000-000000000103"}

PreToolUse: **DENIED**. Reason shown to the model: Blocked: check_refund_eligibility may only run after get_order has succeeded for order 5eed0000-0000-4000-8000-000000000103. Call get_order first.

### 1b. Order lookup first

Model calls `mcp__storefront__get_order` with {"order_id":"5eed0000-0000-4000-8000-000000000103"}

PreToolUse: **allowed**

Raw tool result:

```json
{
 "order_id": "5eed0000-0000-4000-8000-000000000103",
 "status": "paid",
 "age_days": 12
}
```

PostToolUse: result passed through. What the model sees:

```json
{
 "order_id": "5eed0000-0000-4000-8000-000000000103",
 "status": "paid",
 "age_days": 12
}
```

### 1c. Eligibility now allowed

Model calls `mcp__storefront__check_refund_eligibility` with {"order_id":"5eed0000-0000-4000-8000-000000000103"}

PreToolUse: **allowed**

Raw tool result:

```json
{
 "verdict": "eligible",
 "reason": "within_window"
}
```

PostToolUse: result passed through. What the model sees:

```json
{
 "verdict": "eligible",
 "reason": "within_window"
}
```

## Hook 2: human approval for execute_refund (stub)

### 2a. Model tries to refund with no approval

Model calls `mcp__refunds__execute_refund` with {"order_id":"5eed0000-0000-4000-8000-000000000103"}

PreToolUse: **DENIED**. Reason shown to the model: Blocked: execute_refund for order 5eed0000-0000-4000-8000-000000000103 needs approval from a human agent, and none has been recorded. Escalate to a human instead.

### 2b. Model adds its own approval flag

Model calls `mcp__refunds__execute_refund` with {"order_id":"5eed0000-0000-4000-8000-000000000103","human_approved":true}

PreToolUse: **DENIED**. Reason shown to the model: Blocked: execute_refund for order 5eed0000-0000-4000-8000-000000000103 needs approval from a human agent, and none has been recorded. Escalate to a human instead.

_A human agent records approval for this order in the host application (outside the model)._

### 2c. Same call after human approval

Model calls `mcp__refunds__execute_refund` with {"order_id":"5eed0000-0000-4000-8000-000000000103"}

PreToolUse: **allowed**

Raw tool result:

```json
{
 "stub": true,
 "order_id": "5eed0000-0000-4000-8000-000000000103",
 "status": "refund_recorded_not_executed"
}
```

PostToolUse: result passed through. What the model sees:

```json
{
 "stub": true,
 "order_id": "5eed0000-0000-4000-8000-000000000103",
 "status": "refund_recorded_not_executed"
}
```

## Hook 3: result redaction

### 3a. Payment result containing fields the model must not hold

Model calls `mcp__storefront__get_payment_status` with {"order_id":"5eed0000-0000-4000-8000-000000000103"}

PreToolUse: **allowed**

Raw tool result:

```json
{
 "attempts": [
  {
   "result": "refused",
   "customer_reason": "Your bank declined the payment.",
   "refusal_reason": "FRAUD",
   "authorisation_code": "A1B2C3",
   "card_last_four": "4242",
   "expiry_date": "03/30"
  }
 ]
}
```

PostToolUse: **result rewritten**. What the model sees:

```json
{
 "attempts": [
  {
   "result": "refused",
   "customer_reason": "Your bank declined the payment.",
   "refusal_reason": "[redacted]",
   "authorisation_code": "[redacted]",
   "card_last_four": "[redacted]",
   "expiry_date": "[redacted]"
  }
 ]
}
```

Limit: redaction works on named JSON fields. A secret inside free text, or under a field name not on the list, would pass through. The MCP server also never returns these fields, so the hook is a second layer.
