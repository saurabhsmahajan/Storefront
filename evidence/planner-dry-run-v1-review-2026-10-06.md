   # Planner v1 dry run: review (2026-10-06)

   Run: evidence/planner-dry-run-v1-2026-10-06.md. Prompt v1 frozen, criteria
   committed before the run (evidence/planner-dry-run-criteria-2026-10-06.md).

   ## Criteria

   | # | Criterion | Result |
   |---|---|---|
   | 1 | #15 decline+refund, #16 order_status+refund | Met |
   | 2 | #1 to #14 not multi | Met: all 14 single |
   | 3 | #18 to #21 not multi, #21 no refund subtask | Met: empty plans with the right unrouted label |
   | 4 | #17 either way | Split: order_status+refund. Finding. |
   | 5 | At most 2 non-verbatim span failures | Met: 0 |
   | 6 | All 21 return submit_plan | Met: 0 without a plan |

   Counts: 3 multi, 14 single, 4 fallback, 0 no plan.

   ## Findings

   - P1 (overlapping spans): #15's refund subtask is the whole message, so the
     refund specialist also receives the decline question. In #17 both
     subtasks contain "Why was it cancelled". PREDICTION, recorded before
     wiring: the refund specialist in #15 will say another team member
     handles the decline question (a dead-end referral, S1), and the merged
     reply for #17 will say twice that the cancellation reason cannot be seen.
     Prompt v1 is NOT changed on this evidence. If the wired run confirms it,
     v2 is justified by the defect (a specialist handed a question it must
     decline), with the rule: a subtask's question must not contain another
     subtask's question, and shared context may overlap only as a statement.
   - P2 (dropped order ID): #16's second question, "can I return it for a
     refund?", has no order ID. renderForSpecialist adds the Order ID line.
     Works as designed.
   - P3 (empty plans): #18 to #21 return an empty plan with the right unrouted
     label, and validatePlan rejects them (needs 1 subtask, classified route
     not in the plan). Harmless: dispatch decides human_request and
     out_of_scope before any plan is consulted. Not loosened.
   - P4 (latency): planner time was 1.6 to 3.2 s on single-intent messages
     and 4.0 to 6.6 s on the three split ones. It runs beside the classifier,
     so the added wait falls on split messages.

   ## Limits

   - One run per message. The planner's choices can vary between runs.
   - #17 split is an allowed outcome. Whether it is a better answer is decided
     by re-marking the wired run, not assumed.