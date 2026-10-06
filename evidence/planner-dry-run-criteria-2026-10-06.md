   # Planner dry run: pass criteria (2026-10-06)

   Written and committed before the run. The planner prompt is
   agents/layer2/plan-prompt.txt, version v1, frozen: it does not change after
   the run starts. A later change is a new version (v2), logged with the defect
   that justified it. A test message is not a justification.

   Policy A (chosen): split only when a message clearly asks for different things
   that different team members handle. Single-intent messages stay one subtask.

   The dry run only records plans. Nothing is wired into dispatch.

   Pass criteria, all measured on the 21 test messages:
   1. #15 gives a usable plan with decline and refund. #16 gives a usable plan
      with order_status and refund.
   2. #1 to #14 are not a usable multi-subtask plan (a single subtask, or an
      unusable plan that falls back).
   3. #18 to #21 are not a usable multi-subtask plan. #21 never has a refund
      subtask.
   4. #17 may be either. Log which, and mark it as a finding, not a failure.
   5. At most 2 of 21 plans fail validation because a span is not verbatim.
      More means a prompt defect.
   6. All 21 planner calls return a submit_plan call. A missing call counts as a
      failure.

   Usable means validatePlan returns ok against the classifier's route.
   Single-subtask plans and unusable plans both fall back to today's path.

   Also recorded: planner time per message, in parallel with the classifier.