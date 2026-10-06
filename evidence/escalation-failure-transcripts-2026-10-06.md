# Escalation rules R2 to R4: injected failures (2026-10-06)

Each case replaces one part of the system with a stand-in that fails. The dispatch code, the escalation rules and the handoff builder are the real ones. Script: agents/system/rule-transcripts.mjs.

   Result: all five injected failures ended in an escalation with a validated
   handoff package and the expected trigger. Evidence for R2, R3 and R4 of
   evidence/escalation-rules-2026-10-06.md. R1, R5 and R6 are in
   evidence/handoff-and-escalation-2026-10-06.md.

   | Rule | Failure injected | Trigger | Forced stop | Tool errors |
   |---|---|---|---|---|
   | R2 | Router returns no valid label | router_no_label | no | 0 |
   | R2 | Router call throws | api_error | no | 0 |
   | R3 | A specialist loop never finishes | step_cap | yes (step cap 3) | 0 |
   | R3 | A specialist crashes | specialist_error | no | 0 |
   | R4 | A tool that always fails | tool_failure | no | 2 |

   Limits:
   - The failures are stand-ins injected through an optional argument to
     handleMessage. The dispatch code, the rules and the handoff builder are
     the real ones, but the Router and the specialist are not.
   - The R4 case depends on the model making a second failing call. It did here.
     It could stop after one, and then R4 would not fire. One run.
   - The step-cap case used a cap of 3 for speed. The real specialists use 4.
   - A forced stop discards the model's text: the customer gets the generic
     fallback, and the package carries no agent note.
   - Each package says to: human, but nothing receives it (finding G5).

## R2: the Router returns no valid label

Message: Where is order 5eed0000-0000-4000-8000-000000000103?
Expected trigger: router_no_label
Result: trigger=router_no_label, outcome=escalated, forced=false, tool errors=0, steps=0 (AS EXPECTED)

Handoff package:

```json
{
 "version": 1,
 "created_at": "2026-10-06T10:53:26.971Z",
 "from": "router",
 "to": "human",
 "trigger": "router_no_label",
 "customer_message": "Where is order 5eed0000-0000-4000-8000-000000000103?",
 "order_id": "5eed0000-0000-4000-8000-000000000103",
 "findings": [],
 "context": {
  "route": "unknown",
  "steps": 0
 },
 "recommendation": null,
 "agent_note": null,
 "customer_told": "I'm passing you to a human agent who can help you from here.",
 "authorization": {
  "refund_approved": false,
  "approved_by": null,
  "note": "Nothing has been approved. Only a human agent can approve."
 }
}
```

Reply:

> I'm passing you to a human agent who can help you from here.

## R2: the Router call fails

Message: Where is order 5eed0000-0000-4000-8000-000000000103?
Expected trigger: api_error
Result: trigger=api_error, outcome=escalated, forced=false, tool errors=0, steps=0 (AS EXPECTED)

Handoff package:

```json
{
 "version": 1,
 "created_at": "2026-10-06T10:53:26.974Z",
 "from": "router",
 "to": "human",
 "trigger": "api_error",
 "customer_message": "Where is order 5eed0000-0000-4000-8000-000000000103?",
 "order_id": "5eed0000-0000-4000-8000-000000000103",
 "findings": [],
 "context": {
  "route": "router_error",
  "steps": 0
 },
 "recommendation": null,
 "agent_note": null,
 "customer_told": "I'm passing you to a human agent who can help you from here.",
 "authorization": {
  "refund_approved": false,
  "approved_by": null,
  "note": "Nothing has been approved. Only a human agent can approve."
 }
}
```

Reply:

> I'm passing you to a human agent who can help you from here.

## R3: a specialist loop never finishes; the step cap stops it

Message: Where is order 5eed0000-0000-4000-8000-000000000103?
Expected trigger: step_cap
Result: trigger=step_cap, outcome=escalated, forced=true, tool errors=0, steps=3 (AS EXPECTED)

Handoff package:

```json
{
 "version": 1,
 "created_at": "2026-10-06T10:53:31.915Z",
 "from": "order_status",
 "to": "human",
 "trigger": "step_cap",
 "customer_message": "Where is order 5eed0000-0000-4000-8000-000000000103?",
 "order_id": "5eed0000-0000-4000-8000-000000000103",
 "findings": [],
 "context": {
  "route": "order_status",
  "steps": 3
 },
 "recommendation": null,
 "agent_note": "I'm passing you to a human agent who can help you from here.",
 "customer_told": "I'm passing you to a human agent who can help you from here.",
 "authorization": {
  "refund_approved": false,
  "approved_by": null,
  "note": "Nothing has been approved. Only a human agent can approve."
 }
}
```

Reply:

> I'm passing you to a human agent who can help you from here.

## R3: a specialist crashes

Message: Where is order 5eed0000-0000-4000-8000-000000000103?
Expected trigger: specialist_error
Result: trigger=specialist_error, outcome=escalated, forced=false, tool errors=0, steps=0 (AS EXPECTED)

Handoff package:

```json
{
 "version": 1,
 "created_at": "2026-10-06T10:53:31.916Z",
 "from": "order_status",
 "to": "human",
 "trigger": "specialist_error",
 "customer_message": "Where is order 5eed0000-0000-4000-8000-000000000103?",
 "order_id": "5eed0000-0000-4000-8000-000000000103",
 "findings": [],
 "context": {
  "route": "order_status",
  "steps": 0
 },
 "recommendation": null,
 "agent_note": "specialist_error: simulated specialist crash",
 "customer_told": "I'm passing you to a human agent who can help you from here.",
 "authorization": {
  "refund_approved": false,
  "approved_by": null,
  "note": "Nothing has been approved. Only a human agent can approve."
 }
}
```

Reply:

> I'm passing you to a human agent who can help you from here.

## R4: two tool errors in one session

Message: Where are orders 5eed0000-0000-4000-8000-000000000103 and 5eed0000-0000-4000-8000-000000000105?
Expected trigger: tool_failure
Result: trigger=tool_failure, outcome=escalated, forced=false, tool errors=2, steps=2 (AS EXPECTED)

Handoff package:

```json
{
 "version": 1,
 "created_at": "2026-10-06T10:53:35.232Z",
 "from": "order_status",
 "to": "human",
 "trigger": "tool_failure",
 "customer_message": "Where are orders 5eed0000-0000-4000-8000-000000000103 and 5eed0000-0000-4000-8000-000000000105?",
 "order_id": "5eed0000-0000-4000-8000-000000000103",
 "findings": [],
 "context": {
  "route": "order_status",
  "steps": 2
 },
 "recommendation": null,
 "agent_note": "Both lookups failed with a \"simulated tool timeout\" error, so I don't have a status for either order:\n\n- 5eed0000-0000-4000-8000-000000000103: lookup failed\n- 5eed0000-0000-4000-8000-000000000105: lookup failed\n\nDo you want me to try both again?",
 "customer_told": "Both lookups failed with a \"simulated tool timeout\" error, so I don't have a status for either order:\n\n- 5eed0000-0000-4000-8000-000000000103: lookup failed\n- 5eed0000-0000-4000-8000-000000000105: lookup failed\n\nDo you want me to try both again?\n\nI'm passing you to a human agent who can help you from here.",
 "authorization": {
  "refund_approved": false,
  "approved_by": null,
  "note": "Nothing has been approved. Only a human agent can approve."
 }
}
```

Reply:

> Both lookups failed with a "simulated tool timeout" error, so I don't have a status for either order:
> 
> - 5eed0000-0000-4000-8000-000000000103: lookup failed
> - 5eed0000-0000-4000-8000-000000000105: lookup failed
> 
> Do you want me to try both again?
> 
> I'm passing you to a human agent who can help you from here.
