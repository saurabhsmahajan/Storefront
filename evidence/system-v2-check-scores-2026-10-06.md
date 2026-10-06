   # Specialist prompts v2: before and after (2026-10-06)

   Change (commit 1bbdb97): split subtasks always get an "Order ID:" line, and the
   three specialist prompts say to name that order ID in the first sentence of the
   reply. Planner prompt unchanged (v1). Justified by defect D6 (X2), written down
   before the change.
   Run: evidence/system-run-v2-check-2026-10-06.md (committed unscored in f69d4cf).
   Before: evidence/system-run-decompose-2026-10-06.md and
   evidence/system-decompose-scores-2026-10-06.md. Rules are the same as Layers 1
   to 3.

   | # | v1 marks | v2 marks | Note |
   |---|---|---|---|
   | X2 | N / N / Y | Y / N / Y | Each answer opens with its own order ID. The refund statement is attached to order 104: "For order ...104, I can't say yes or no to a refund. The refund policy doesn't cover this case." D6 fixed. |
   | 17 | Y / N / Y | Y / N / Y | Same marks, same split. D1 and D2 are still in the reply: the order-status part deflects ("Another team member handles refunds and payment questions") and says it cannot see payment details, and three paragraphs later the refund part says the payment was authorised but not captured. v2 did not address them. |
   | 1 | Y / N / Y | Y / N / Y | Single-intent control unchanged: one reply, order ID in the first sentence, no "Order ID:" line, no referral, no subtasks. |

   ## Reading

   - D6 is fixed on the message that showed it.
   - D1 and D2 are structural. D1 comes from the planner giving the order-status
     specialist "I was charged" as context, which its prompt tells it to refuse.
     D2 follows from D1. A prompt rule cannot remove a sentence the specialist is
     required to write. A fix would be a planner v2 (split spans may not carry
     out-of-remit context). Not done: it would need a fresh 21-message dry run.
     Recorded as a known limit.
   - #17's human package is correct in both runs: policy_gap, authorised not
     captured, cancellation recorded.

   ## Limits

   - One run per message. X2 and #17 are single runs of models, so a rerun can
     differ. #17 split the same way as in v1, so the comparison is like for like.
   - Only three messages were rerun. The other 24 were not re-marked. They are
     covered by the 102 tests and by the single-intent path being unchanged, not
     by v2 replies.
   - The v2 times were higher (X2 10.1 s against 6.7 s, #17 13.2 s against
     10.6 s). One run each cannot separate the prompt change from model and
     network variation. Not a finding.
   - The specialist prompts have inconsistent indentation on the new paragraph
     (a paste artefact). The model reads the same text.