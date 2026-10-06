   # Step G: handoffs and escalation (2026-10-06)

   Code: agents/lib/handoff.mjs, agents/lib/escalation-rules.mjs,
   agents/system/dispatch.mjs, agents/lib/loop.mjs. Tests: 30 passing across
   refund-rules, handoff and escalation-rules (node --test, three files).
   Rules table: evidence/escalation-rules-2026-10-06.md.
   Run: evidence/system-run-step-g-2026-10-06.md (all 21 messages, packages
   included).

   What changed: the specialists lost escalate_to_human, so the model no longer
   decides whether to escalate. Code does, from the route, the loop outcome and
   the refund verdict. Code builds the handoff package and appends a fixed
   handoff sentence to the reply. Only the six messages whose path changed are
   re-marked. The other 15 pass through code that step G did not touch and keep
   their earlier marks.

   ## Transcript per rule

   | Rule | Transcript | Tools first? | What the package shows |
   |---|---|---|---|
   | R1 explicit human request | #18, #19 | No: steps=0 | trigger explicit_human_request, from router. #19 carries the order ID. |
   | R5 policy gap | #17 | Yes: check_refund_eligibility ran first | trigger policy_gap, recommendation null, findings authorised yes, captured no, cancellation recorded yes. |
   | R6 refund recommendation | #11, #16 | Yes | trigger refund_recommendation, recommendation "Full refund ... A human decides." |
   | R2, R3, R4 | not yet | | Needs injected failures: the next sub-step. |

   Every package: authorization.refund_approved false, approved_by null.

   ## Marks for the six re-marked messages

   | # | Correct | Invented | Escalation right | Note |
   |---|---|---|---|---|
   | 11 | Y | N | Y | Eligible, fixed handoff line, human decides. |
   | 14 | Y | N | Y | Nothing to refund, human offered, no escalation, no fact-flag dump. |
   | 16 | N | N | Y | Refund half correct and escalated. Location half still declined (S5). |
   | 17 | Y | N | Y | Policy gap, hold explained, nothing promised or invented. |
   | 18 | Y | N | Y | Code, no tools, package built. |
   | 19 | Y | N | Y | Same, order ID in the package. |

   Totals are unchanged (16 correct, 0 invented, 21 of 21 escalation right).
   What changed is who decides and what the human receives.

   ## Findings

   - S3 (the human "will approve"): fixed. #11 says a human decides.
   - S4 (fact flags shown to the customer): fixed in #14.
   - G1 (#11): the fixed handoff line repeats the model's sentence "a human
     agent decides every refund". Redundant.
   - G2 (#16): the package does not mark the unanswered delivery question. The
     human sees it only inside customer_message.
   - G3 (#13): the reply ends "let me know" with no route to a human. The
     earlier run offered one before the specialist prompts dropped that line.
     R1 still works if the customer asks.
   - G4 (#14): the customer says they were charged, the verdict is never_paid,
     and nothing escalates. The rules read verdicts, not customer claims. This
     follows the test set (offer, do not escalate) and is accepted.
   - G5: packages are only written to the run file. Nothing receives them: "to:
     human" is a label until a queue or ticket exists.

   ## Known limits

   - One run. No transcripts yet for R2 (router fails), R3 (forced loop
     failure) or R4 (repeated tool errors).
   - The model still writes the explanatory text that becomes agent_note, which
     is unverified. Only the findings are built by code.
   - A model that ignores its prompt could still mention approval in free text.
     The code does not scan replies for it.