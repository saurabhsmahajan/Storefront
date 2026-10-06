   # Escalation rules (2026-10-06)

   Implemented as a pure function in agents/lib/escalation-rules.mjs, tested in
   agents/lib/escalation-rules.test.mjs. The model no longer decides whether to
   escalate: code does, from the route, the loop outcome and the refund verdict.
   A built handoff package (agents/lib/handoff.mjs) carries the context.

   | Rule | Condition | Tools first? | Trigger |
   |---|---|---|---|
   | R1 | The customer asked for a human | No, immediate | explicit_human_request |
   | R2 | The Router returned no valid label, or failed | No | router_no_label, api_error |
   | R3 | The loop was forced to stop (step cap, API error, empty reply, unexpected stop, specialist crash) | Yes, it tried | step_cap, api_error, empty_reply, unexpected_stop, specialist_error |
   | R4 | Two or more tool errors in one session | Yes | tool_failure |
   | R5 | Refund verdict no_rule: the policy has no rule | Yes | policy_gap |
   | R6 | Refund verdict eligible: a human approves every refund | Yes | refund_recommendation |
   | none | Anything else, including not_eligible and not_found | | |

   Priority is the order above: R1 beats everything, and a forced loop failure
   (R3) beats a refund verdict.

   Authorisation state: every handoff package says nothing is approved. The
   builder ignores any attempt to set it, and the validator rejects a package
   that claims otherwise.

   Evidence still to produce: one transcript per rule, from the running system
   (step G, last part).