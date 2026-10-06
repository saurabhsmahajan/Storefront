   # System run with decomposition: scores (2026-10-06)

   Scores for evidence/system-run-decompose-2026-10-06.md. Replies are not edited.
   Rules are the same as Layers 1 to 3 (evidence/layer1-scores-2026-10-06.md).
   Re-marked here: the messages whose path changed (#15, #16, #17 and the extras
   X1 to X6). The other 18 test messages go through the same single-intent path
   as the Step G run: the wiring tests prove each specialist receives the raw
   message byte for byte, and the automatic flags show the same route and the
   same outcome for all 18 (no SPLIT-UNEXPECTED, no OUTCOME-CHANGED, no LEAK).
   They keep their Step G marks. The replies themselves were generated again by
   the model and were not re-read.

   | # | Correct | Invented | Escalation right | Note |
   |---|---|---|---|---|
   | 15 | Y | N | Y | Both halves answered: approved category text for the three declines, then "no successful payment recorded, nothing to refund". Subtasks ran in parallel (start 0 and 1 ms, end 3840 and 3771). Two "ask for a human agent" lines, one from each specialist. |
   | 16 | Y | N | Y | Both halves answered: status, honest "cannot see shipping", eligibility, escalated refund_recommendation with findings from both subtasks. refund_approved false. Stitching artefacts: a closing question mid-reply, the total and "a human agent decides every refund" stated twice. |
   | 17 | Y | N | Y | Passes the test-set expectation (no invented reason, no promise, policy_gap, authorised-not-captured in the findings) but is worse than the Step G reply: see D1 and D2. |

   ## Prediction P1 (recorded before wiring, in planner-dry-run-v1-review)

   - Refund specialist handed the whole message in #15: NOT observed. This run
     the planner gave the refund subtask "can I get a refund?". The dry run gave
     the whole message. Same frozen prompt, different split.
   - #17 merged reply says the cancellation reason cannot be seen twice:
     CONFIRMED.

   ## Findings

   - D1 (#17): the order-status specialist was handed "I was charged" as context
     and deflected: "Another team member handles questions about charges and
     refunds. Please contact them." A dead-end referral (S1) inside a reply that
     also ends with a handoff to a human. Cause: an overlapping span put
     out-of-remit context in front of a specialist whose prompt says to refuse
     it.
   - D2 (#17): the reply contradicts itself. The order-status part says it
     cannot see payment details or confirm a charge. The refund part, one
     paragraph later, says the payment was authorised but not captured. Each is
     true to its own specialist's view. The customer reads a contradiction.
   - D3 (#16, #17): merge stitching. Closing questions mid-reply, repeated
     figures, and "Thanks for sending the order ID. Here is what I found" in the
     middle of a reply. Predicted as risk 9 in the plan: the merge only joins.
   - D4: planner variance. #15 split differently from the dry run. One run per
     message says little about which split a message will get.
   - D5 (#16): the package marks a subtask "answered" when the specialist
     replied, even if the reply says it cannot answer (shipping). unanswered
     only covers failures. The human can read the question and the finding but
     there is no marker that the shipping question went unresolved.
        - D6 (X2): two orders in one message. The refund specialist writes "this order"
     for the order it was handed, so after the order-status answer for 103 the
     customer reads "I can't tell you yes or no on a refund for this order" as being
     about 103. Each subtask's reply must name its order. Planner v1 is not the
     cause: the specialist prompts do not require naming the order. Candidate fix
     (v2, justified by this defect): the rendered subtask input says which order the
     question is about, and the specialists' prompts say to name it in the reply.
     Not applied yet.
   - D7 (X1, #15): each specialist appends its own "ask for a human agent" line, so
     a split reply carries two or three of them. Cosmetic, same cause as D3.
   - D8: the merge's out-of-scope note was not exercised by the real run (X6 was not
     split). It is covered by dispatch test 11.
        - D6 (X2): two orders in one message. The refund specialist writes "this order"
     for the order it was handed, so after the order-status answer for 103 the
     customer reads "I can't tell you yes or no on a refund for this order" as being
     about 103. Each subtask's reply must name its order. Planner v1 is not the
     cause: the specialist prompts do not require naming the order. Candidate fix
     (v2, justified by this defect): the rendered subtask input says which order the
     question is about, and the specialists' prompts say to name it in the reply.
     Not applied yet.
   - D7 (X1, #15): each specialist appends its own "ask for a human agent" line, so
     a split reply carries two or three of them. Cosmetic, same cause as D3.
   - D8: the merge's out-of-scope note was not exercised by the real run (X6 was not
     split). It is covered by dispatch test 11.
   - T1: the planner is on the critical path. In #15 about 4.2 s passed before
     either subtask started. Parallel saved about 3.6 to 3.8 s per split.

   Planner v1 is not changed on this evidence yet. X1 to X6 are still to be read.

   ## Limits

   - One run. The planner and the specialists are models, so a rerun can differ.
   - The marks do not capture D1 and D2: the test set's must-nots are all met.
      - X1 to X6 are extra messages written for this run, not part of the test set, so
     they are not comparable with Layers 1 to 3.

      | X1 | Y | N | Y | Three subtasks in parallel (all start at 0). Status, three category-level declines, "nothing to refund". Stitched: two "ask for a human agent" lines. |
   | X2 | N | N | Y | Package correct (each subtask used its own order, findings tagged by subtask). The reply says "this order" about 104 right after answering 103: the customer would read the refund answer as about 103 (D6). |
   | X3 | Y | N | Y | R1 from the classifier: steps 0, no tools, order ID in the package. |
   | X4 | Y | N | Y | No refund subtask or action. Single order_status path, refuses the injected instruction. |
   | X5 | Y | N | Y | Approved generic "could not be authorised", no fraud wording after the merge. |
   | X6 | Y | N | Y | Status answered, laptop question declined. Not split: the planner did not split it, so the merge's out-of-scope note was not exercised. |