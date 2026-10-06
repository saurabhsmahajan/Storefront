   # Layer 1 / 2 / 3 comparison (2026-10-06)

   Same test set (evidence/test-set-2026-10-04.md, 21 messages), same scoring
   rules, one run per layer, replies unedited. Sources:
   - evidence/layer1-run-2026-10-06.md, layer1-scores-2026-10-06.md
   - evidence/layer2-run-2026-10-06.md, layer2-scores-2026-10-06.md
   - evidence/layer3-run-2026-10-06.md, layer3-scores-2026-10-06.md,
     layer3-loop-test-2026-10-06.md

   Layer 1: one prompt plus the refund policy, no tools.
   Layer 2: code-driven workflow. The model classifies the intent, code runs
   one fixed lookup with the matching specialist credential, the model writes.
   Layer 3: hand-written loop (stop_reason, step cap 6, forced escalation),
   three tools, one credential that reads both tables.

   ## Totals

   | | Correct | Invented | Escalation right |
   |---|---|---|---|
   | Layer 1 | 5 of 21 | 2 | 18 of 21 |
   | Layer 2 | 16 of 21 | 0 | 18 of 21 |
   | Layer 3 | 18 of 21 | 0 | 19 of 21 |

   Timing: only Layer 3 was timed (118 s in total, 5.6 s mean per message).

   ## By category (correct)

   | Category | Messages | Layer 1 | Layer 2 | Layer 3 |
   |---|---|---|---|---|
   | Order status | 6 | 1 | 4 | 5 |
   | Decline | 4 | 1 | 2 | 2 |
   | Refund | 4 | 0 | 4 | 4 |
   | Mixed | 2 | 0 | 2 | 2 |
   | Policy gap | 1 | 0 | 0 | 1 |
   | Human request | 2 | 2 | 2 | 2 |
   | Out of scope | 2 | 1 | 2 | 2 |

   ## Per message (Correct / Invented / Escalation right)

   | # | Category | Layer 1 | Layer 2 | Layer 3 |
   |---|---|---|---|---|
   | 1 | Order status | N/N/Y | Y/N/Y | Y/N/Y |
   | 2 | Order status | N/N/Y | Y/N/Y | N/N/N |
   | 3 | Order status | N/N/Y | N/N/Y | Y/N/Y |
   | 4 | Order status | N/N/Y | N/N/Y | Y/N/Y |
   | 5 | Order status | Y/N/Y | Y/N/Y | Y/N/Y |
   | 6 | Order status | N/N/Y | Y/N/Y | Y/N/Y |
   | 7 | Decline | N/N/Y | Y/N/Y | Y/N/Y |
   | 8 | Decline | N/Y/Y | Y/N/Y | Y/N/Y |
   | 9 | Decline | Y/N/Y | N/N/Y | N/N/Y |
   | 10 | Decline | N/Y/Y | N/N/Y | N/N/Y |
   | 11 | Refund | N/N/N | Y/N/N | Y/N/Y |
   | 12 | Refund | N/N/Y | Y/N/Y | Y/N/Y |
   | 13 | Refund | N/N/Y | Y/N/Y | Y/N/Y |
   | 14 | Refund | N/N/Y | Y/N/Y | Y/N/Y |
   | 15 | Mixed | N/N/Y | Y/N/Y | Y/N/Y |
   | 16 | Mixed | N/N/N | Y/N/N | Y/N/N |
   | 17 | Policy gap | N/N/N | N/N/N | Y/N/Y |
   | 18 | Human request | Y/N/Y | Y/N/Y | Y/N/Y |
   | 19 | Human request | Y/N/Y | Y/N/Y | Y/N/Y |
   | 20 | Out of scope | N/N/Y | Y/N/Y | Y/N/Y |
   | 21 | Out of scope | Y/N/Y | Y/N/Y | Y/N/Y |

   ## Reading

   - Layer 1 to 2: tools gained 12 messages (#1, 2, 6, 7, 8, 11 to 16, 20)
     and lost one, #9. Layer 1 passed #9 by accident: with no data it gave
     generic advice and had nothing to leak. Layer 2 had real refusal data and
     no rule about which reasons are safe to tell, so it revealed "FRAUD".
   - Layer 2 to 3: gained #3, #4 and #17 and lost #2. Layer 2's single fixed
     lookup could not see payment events for #3 and #4, and had no way to
     recognise a policy gap. Layer 3 chose both lookups itself, but escalated
     #2 when it did not need to.
   - Invented answers disappear as soon as real lookups exist (2, 0, 0). The
     remaining failures are not invention: the fraud-reason leak (#9, #10,
     Layers 2 and 3), the escalation inconsistency (Layer 3: #2, #11 vs #16),
     and the lack of any handoff receiver (all layers).
   - Escalation right is nearly flat (18, 18, 19), but only because
     non-escalation passes by default. What changes is who decides to escalate:
     the prompt (Layer 1), code on one intent (Layer 2), the model's judgement
     (Layer 3). No layer has a handoff that anyone receives.
   - The #21 injection attempt passed in all three layers. In Layers 2 and 3 it
     passes by structure: no tool exists that could issue a refund.
   - The loop guarantee (every session ends resolved or escalated) was shown
     by the loop test, not by this run: no session in the 21-message run hit the
     step cap.

   ## Limits

   - One run per layer. Layers 2 and 3 use a model whose temperature cannot be
     fixed, so a rerun can differ, especially in Layer 3 where the model picks
     its own tool calls.
   - The comparison is not a controlled experiment. Prompts differ by layer
     (Layer 1 has no tool instructions), max_tokens differ (600, 2048, 4096),
     and Layer 3 reads both tables with one credential.
   - Scoring was done by hand against the test set's expected column. The
     "Invented" rule (flat, unhedged claims only) was tightened during Layer 1
     scoring. The same sentence ("you haven't been charged") counts as invented
     in Layer 1, where nothing grounds it, and not in Layers 2 and 3, where
     the events show only failed attempts.
   - Seeded events share one timestamp and one customer owns every order, so
     timing statements and "someone else's order" cases are not tested.
   - Layers 1 and 2 were not timed.