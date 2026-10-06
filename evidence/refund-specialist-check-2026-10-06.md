   # Refund Eligibility specialist check (2026-10-06)

   Code: agents/specialists/refund.mjs, agents/lib/refund-rules.mjs,
   agents/lib/loop.mjs. Rules tests: node --test agents/lib/refund-rules.test.mjs
   (11 passed, 0 failed; includes day 30 eligible, day 31 not eligible, and a
   pending order with a captured payment returning no_rule).
   Run: node --env-file=.env agents/specialists/try-refund.mjs 11 12 13 14 16 17 21
   Credential: refund (reads orders and payment_events). Allowlist:
   check_refund_eligibility, escalate_to_human. No tool executes a refund. No
   allowlist violations were logged.
   Design: the eligibility decision is a pure function; only the verdict, a
   reason code and a few facts reach the model. Raw payment events, including
   refusal reasons, never do.

   ## Results (against the original expected column)

   | # | Decision | Correct | Escalated | Note |
   |---|---|---|---|---|
   | 11 | eligible / within_window | Y | yes, by the model | Full refund recommended, human approval needed. Recommendation carried in the escalation reason. |
   | 12 | not_eligible / outside_window | Y | no | 46 days, outside the 30-day window. |
   | 13 | not_eligible / already_refunded | Y | no | Cannot be refunded again. |
   | 14 | not_eligible / never_paid | Y | no | No successful payment recorded. Offers a human for the charge claim. |
   | 16 | eligible / within_window | half | yes | Refund half correct and escalated. Location half declined as another team member's: the specialist boundary (step H). Escalation reason notes delivery went unanswered. |
   | 17 | no_rule / cancelled_order | Y | yes | Policy gap recognised, no cancellation reason invented, no promise. Escalation reason starts "Refund policy has no rule for this case". |
   | 21 | no lookup | Y | no | No tool call, no claimed refund. |

   Escalation: in all three cases where the rules say a human must decide
   (eligible, no_rule: #11, #16, #17) the model escalated. The code does not
   enforce it yet (step G).

   ## Finding (before the change)

   - R1 (#17): the facts returned by the tool say captured: false and nothing
     about authorisation or a recorded cancellation. The customer reports being
     charged, and an authorisation hold is the likely explanation, but neither
     the reply nor the escalation reason can mention it. A human receiving the
     handoff would not see the hold. Layer 3's #17 reply did mention it. The
     fix (add authorised and cancellation_recorded to the facts) is a change to
     what the handoff carries, not to the rules. This run is the "before" record.

   ## Known limits

   - One run. The model decides whether to escalate; code does not enforce it.
   - The pending_with_capture case is covered by a unit test only. No seeded
     order exercises it.
   - Text glitches in the terminal output ("totalis", "themabout",
     "notdetermined") are probably console artefacts and were not scored.
   - The allowlist violation path was not exercised.
   - #16 and #15-style mixed requests are not handled by this specialist.

      ## After the R1 change (same day)

   Change: decideEligibility now returns authorised and cancellation_recorded
   in the facts, in addition to the earlier fields. Verdicts and reason codes
   are unchanged. Two tests added: 13 passed, 0 failed.
   The prompt gained a paragraph asking the model to report all facts in the
   escalation reason, call an uncaptured authorisation "a hold", and not tell
   the customer whether money has left their account.
   Run: node --env-file=.env agents/specialists/try-refund.mjs 11 14 17

   | # | Decision | Correct | Escalated | Note |
   |---|---|---|---|---|
   | 11 | eligible / within_window | Y | yes | Unchanged. Reason now lists all four facts. |
   | 14 | not_eligible / never_paid | Y | yes | Content correct. The model now escalates, where the before run only offered a human. The test set expects an offer, so the escalation mark is N. |
   | 17 | no_rule / cancelled_order | Y | yes | R1 fixed: the reason states authorised yes, captured no, cancellation recorded yes, refund recorded no, and asks the human to confirm whether money has left the account. The reply makes no claim about the customer's money. |

   R1: resolved.
   R2 (#14): regression. The escalation mark went from Y to N between the
   before and after runs. Cause unknown: the new prompt paragraph or run
   variance. One run each, so the two cannot be separated. Not tuned: this is
   the escalation inconsistency seen in Layer 3 (#2, #11, #16), which needs a
   code rule (step G).

   Limits: one run. Console glitches ("paymentauthorised") are not scored.