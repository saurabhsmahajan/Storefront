# Week 3 step A: Week 2 carry-over decision (2026-10-14)

## State at the start of Week 3

- Tag `week-2-complete` exists locally and on origin. It points at commit 94fe3fa on main (the Week 2 evidence index).
- Tracker update (Week 2 close-out): done by the project owner, outside this repository.

## Where each open Week 2 item goes

| Item | What it is | Decision | Where it lands in Week 3 |
|---|---|---|---|
| I6a | A tool exception's raw text is passed to the model | Move | Step D (structured MCP errors, never a raw exception) and step F (PostToolUse hook) |
| I6b | One tool error does not escalate | Move | Step D (error type, retryable flag, next action) and step F (PostToolUse hook rejects a malformed result) |
| R-04 | Anyone with an order ID can read that order (no per-customer scoping) | Move | Step D (policy-scoped credentials: only the signed-in customer's rows) and step H (RLS on conversations) |
| I13 | A timed-out call is not cancelled | Parked | Not in the Week 3 plan |
| R-09 | Escalations that nobody receives | Parked by this decision. Step G gives the handoff package a receiver (the confirmation screen), so reassess it at step K | Step G (partial), step K |
| R-13 | The customer is not told they are talking to an AI | Parked | Not in the Week 3 plan |
| D1, D2, D4 | Planner issues (#17 contradiction, dead-end referral, split varying between runs) | Parked | Not in the Week 3 plan |
| G3 | #13 still ends without a route to a human | Parked | Not in the Week 3 plan |
| Dependent subtasks | Designed in the plan, not built | Parked | Not in the Week 3 plan |
| R-08 | Dependence on one third-party model | Parked | Week 5 review |
| Step cap wording | The register says a step cap of 6, specialists pass maxSteps 4 | Parked | Reconcile at the Week 5 register review |
| Dead branch | The escalate_to_human branch in loop.mjs is unreachable in the specialists | Parked | Code review item |

## Risks that Week 3 will touch (step K)

R-03 (refund approval), R-04 (customer scoping), R-07 (tool errors), R-11 (card data in logs). Their residual ratings are updated at step K, not here.

## Limits

- The tracker lives outside this repository, so the Week 2 close-out entry is not verified here.
- "Parked" means no work is planned this week. It does not mean the risk is accepted.
