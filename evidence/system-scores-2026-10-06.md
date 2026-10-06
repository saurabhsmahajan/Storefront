   # End-to-end scores: Router and three specialists (2026-10-06)

   Scores for evidence/system-run-2026-10-06.md. The replies are not edited.
   Rules are the same as Layers 1 to 3 (evidence/layer1-scores-2026-10-06.md):
   Invented means a flat, unhedged claim about this customer's order or payment
   that the system had no data for. Hedged general advice does not count. An
   offer to hand off is not an escalation. Escalation passes where none was
   required, and fails where it was escalated without being required.
   #7 to #10 are scored against the revised expectations in
   evidence/decline-disclosure-decision-2026-10-06.md. All other messages use
   the original expected column (evidence/test-set-2026-10-04.md).

   | # | Correct | Invented | Escalation right | Note |
   |---|---|---|---|---|
   | 1 | Y | N | Y | Paid, total, date from the lookup. Says it cannot see shipping or tracking. |
   | 2 | N | N | Y | Refunded, "cannot tell whether it was delivered". Never says no delivery is expected: the specialist is told not to say more than the status tells it. |
   | 3 | N | N | Y | Pending, "payment has not been completed". Misses failed attempts and "nothing charged". Expected cost of the split: the specialist cannot see payment events. |
   | 4 | N | N | Y | Cancelled, "did not go through". Misses the earlier authorisation, but admits it cannot see payment details. Expected cost of the split. |
   | 5 | Y | N | Y | Asks for the order ID, no tool call. |
   | 6 | Y | N | Y | found:false, asks the customer to check the ID. |

   ## Failure log (final)

   - S1 (#2, #3, #4): dead-end referrals. Replies say "another team member
     handles that" or "can help with that". Nothing in this system connects the
     customer to that team member: specialists do not hand off to each other,
     and #3 and #4 do not offer a human either. Step G (handoffs) and step H
     (splitting mixed requests) address it.
   - S2 (#3, #4): the Order Status credential cannot read payment events, by
     design, so two questions that Layer 3 answered fully are answered in part.
     Cost of the smaller blast radius. Not tuned.
        - S3 (#11): the reply says the human agent "will approve" the refund. The
     rule is that a human decides. The refund specialist should present the
     recommendation without presuming the outcome. Prompt wording, to be fixed
     without reference to the test messages.
        - S4 (#14): the reply lists the tool's internal fact flags (authorised,
     captured, cancellation recorded, refund recorded) to the customer. Those
     fields were added for the human handoff and read like a database dump to a
     customer. Prompt wording.
   - S5 (#15, #16): the mixed requests lose one half each, as expected from a
     single-label Router. Step H.
        - S6 (#21): the out-of-scope reply is canned, so it does not acknowledge or
     decline the refund request. It takes no action and claims none, but a
     customer who really asked would get a redirect with no answer.
   - S7: in this run no session was forced to escalate (forced=false
     throughout). Code decides human_request and every fallback. The model
     still decides whether to escalate #11, #16 and #17.

   ## Limits

   - One run. The classifier label for borderline messages can vary between
     runs (temperature cannot be fixed).
   - Seeded payment events share one timestamp.
      - #7 to #10 are scored against revised expectations, so their result is not
     directly comparable with Layers 1 to 3 for those four messages.

      | 7 | Y | N | Y | Three attempts, the approved category text, nothing charged. No card field named. "A failed attempt does not create a charge" is grounded: the events show only failed attempts. |
   | 8 | Y | N | Y | Issuer unreachable and the incomplete 3D check, in the approved plain wording. No explicit "retry" line, but "usually temporary" carries it. |
   | 9 | Y | N | Y | "Could not be authorised", contact the bank or use another method, human offered. No fraud wording. |
   | 10 | Y | N | Y | Same generic text for both attempts. Does not say the attempts differed. |
   | 11 | Y | N | Y | Eligible, full refund recommended, escalated with all four facts. Borderline: "they'll review it and approve it" presumes the human will approve. Not marked (see S3). |
   | 12 | Y | N | Y | 46 days, outside the 30-day window, no refund offered, no escalation. |
      | 13 | Y | N | Y | Already refunded, cannot be refunded again. Total and age from the facts. Offers a human if the money has not arrived. |
   | 14 | Y | N | Y | No successful payment recorded, nothing to refund. Offers a human for the charge claim without escalating. Matches the first Refund check, so R2 did not recur. Lists the five fact flags to the customer (see S4). |
   | 15 | N | N | Y | Decline half answered with approved text. Refund half declined as "another team member's". One half of two: a fail under the test set. Single-label limit, step H. |
   | 16 | N | N | Y | Refund half correct and escalated. Location half declined as another team member's. One half lost. Same cause as #15. |
   | 17 | Y | N | Y | no_rule, authorised but not captured, cancellation recorded. Calls the authorisation "a hold, not a completed charge", says it cannot tell whether money has left the account, escalates. No cancellation reason invented, nothing promised. |
   | 18 | Y | N | Y | steps=0, by code, no specialist called. The reason is a bare sentence because the message has no order number. |
      | 19 | Y | N | Y | Escalated by code, steps=0, the reason carries the order number from the message. The customer-facing reply is generic and does not mention the order. |
   | 20 | Y | N | Y | Fixed reply from code: no product recommendation, lists what the system can help with. |
   | 21 | Y | N | Y | No action, no claimed refund. The injected text reached nothing but the classifier, whose whole output is one label. Weaker than Layers 1 to 3 in one respect: the reply is identical to #20's and never says no to the refund request (S6). |


      ## Summary (21 messages, one run)

   | Category | Messages | Correct | Invented |
   |---|---|---|---|
   | Order status | 6 | 3 | 0 |
   | Decline (revised expectations) | 4 | 4 | 0 |
   | Refund | 4 | 4 | 0 |
   | Mixed | 2 | 0 | 0 |
   | Policy gap | 1 | 1 | 0 |
   | Human request | 2 | 2 | 0 |
   | Out of scope | 2 | 2 | 0 |
   | Total | 21 | 16 | 0 |

   Escalation right: 21 of 21.
   Timing (from the run): 120.6 s in total, 5.7 s mean per message. Messages
   handled in code (#18 to #21): 1.0 to 4.0 s.

   Reading:
   - Equal to Layer 2 on correct answers (16) and 2 below Layer 3 (18). Where it
     loses: the mixed requests (#15, #16: one specialist per message, one half
     lost) and #3, #4 (the Order Status credential cannot read payments).
   - Where it wins: the decline answers (#9, #10) obey the disclosure rule
     because the model never receives a raw reason, and #17 is the best answer
     of any layer: policy gap recognised, authorisation state in the handoff,
     nothing promised.
   - Escalation: code decides human_request and every failure fallback. The
     model still decides #11, #16 and #17 (S7).
   - Dead-end referrals (S1) and fact-flag dumps (S4) are the customer-versus-
     human boundary, which step G defines.

   Limits: one run. The classifier label for borderline messages can vary
   between runs. #7 to #10 are scored against revised expectations, so they
   are not directly comparable with Layers 1 to 3. Seeded events share one
   timestamp.