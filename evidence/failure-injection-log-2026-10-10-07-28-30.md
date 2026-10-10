# Failure injection log (2026-10-10-07-28-30)

Plan and expectations: evidence/failure-injection-plan-2026-10-06.md, committed before this run.
Script: agents/system/failure-injection.mjs. Node v24.16.0.
Instrument: the real dispatch, loop, specialists, planner, classifier, escalation rules and handoff builder. The model SDK and the database module are replaced by scripted stand-ins, so each failure is exact and repeatable. This tests the system's mechanics. It does not show how a real model words a reply after a failure.

| # | Failure | Predicted | Expected | Observed | Result |
|---|---|---|---|---|---|
| I1 | A tool call that never returns (single path) | FAIL: the session hangs | Session ends resolved or escalated, with a valid package | no result after 4000 ms: the session hangs | FAIL |
| I2 | A tool call that never returns (split path) | PASS | Escalated, trigger specialist_error, within timeoutMs, other part answered, failed part in unanswered | outcome=escalated route=multi:order_status+refund trigger=specialist_error from=system to=human steps=0 ms=1517 unanswered=1 | PASS |
| I3 | A lookup that finds nothing for a real order ID (order status) | PASS | Resolved, no escalation, the model is shown exactly {found:false} and nothing else about the order | outcome=resolved route=order_status steps=2 ms=1 model was shown: {"found":false} | PASS |
| I4 | A lookup that finds nothing (refund, no order) | PASS | Resolved, verdict not_found, no escalation, no package | outcome=resolved route=refund steps=2 ms=0 verdict=not_found | PASS |
| I5 | Malformed payment events (decline): no payload, no reason, unknown and odd reasons | PASS | No crash. Every failed attempt gets the never_tell text. No raw reason reaches the model. | outcome=resolved route=decline steps=2 ms=0 declined_attempts=4 all_generic=true raw_leak=false | PASS |
| I6 | Malformed order lookup: the database returns a string, not an order | UNKNOWN | No crash. The tool errors are counted. Two errors escalate with tool_failure. The customer never sees a made-up status. | outcome=escalated route=order_status trigger=tool_failure from=order_status to=human steps=3 ms=2 tool errors shown=2 first error: Cannot read properties of undefined (reading 'slice') | PASS |
| I7 | A specialist that returns nothing (undefined) | UNKNOWN | Escalated, trigger specialist_error, valid package | outcome=escalated route=error trigger=specialist_error from=system to=human steps=0 ms=0 | PASS |
| I8 | A specialist whose final reply is empty | PASS | Escalated, trigger empty_reply, the fixed fallback reply | outcome=escalated route=order_status trigger=empty_reply from=order_status to=human steps=2 ms=0 | PASS |
| I9 | A model API error inside a specialist loop (refund) | PASS | Escalated, trigger api_error, the fixed fallback reply | outcome=escalated route=refund trigger=api_error from=refund to=human steps=1 ms=0 | PASS |
| I10 | A model API error in the planner only | PASS | The single path runs as today: resolved, the specialist receives the raw message unchanged | outcome=resolved route=order_status steps=0 ms=0 specialist input identical to raw message=true | PASS |
| I11 | A model API error in the planner and the classifier | PASS | Escalated, trigger api_error, no steps, package from the router | outcome=escalated route=router_error trigger=api_error from=router to=human steps=0 ms=0 | PASS |

10 of 11 rows passed.
