   # Week 2 evidence index (2026-10-12)

   Storefront support agent: a Router plus three specialists (Order Status, Decline
   Explainer, Refund Eligibility), with code-owned escalation and handoff packages.

   ## How to read this folder

   - Raw runs (layer1-run, layer2-run, layer3-run, system-run*, system-run-decompose,
     system-run-v2-check) are model output, committed before scoring. They are not
     edited.
   - Scores are in separate files (layer1-scores and so on), so a diff shows that
     only marks were added.
   - Predictions come first. Test sets, answer keys, plans and pass criteria were
     committed before the run they judge. A fix has a before run, a control where the
     instrument changed, and an after run.
   - Every file states its own limits. The numbers are one run per message on a
     21-message hand-scored set, not a measurement of real traffic.
   - decoy-secret.txt and decoy-control.txt are fixtures for the permission test.
     They contain fake values.

   ## By step

   | Step | What it shows | Files |
   |---|---|---|
   | A. Week 1 carry-over | Hook and permission enforcement, RLS, PCI scope | formatting-skips, permission-deny-test, hook-enforcement-test, rls-policy-and-query, pci-scope-note, webhook-test-log |
   | B. Prerequisites | The 21-message test set with ground truth; scoped credentials | test-set-2026-10-04, specialist-credential-scoping, specialist-credential-real-signin |
   | C. Layer 1, plain chatbot | No tools: 5 of 21 correct, 2 invented | layer1-run, layer1-scores |
   | D. Layer 2, fixed workflow | One lookup per intent: 16 of 21, 0 invented; failure log | layer2-run, layer2-scores |
   | E. Layer 3, hand-written loop | Agent loop with a step cap: 18 of 21, 0 invented; loop test; comparison table | layer3-run, layer3-scores, layer3-loop-test, layer-comparison |
   | F. Router and specialists | Per-specialist credentials; decline disclosure rule enforced in code; classifier chosen over agentic Router; end-to-end run | decline-disclosure-decision, decline-explainer-check, order-status-check, refund-specialist-check, router-expected-routes, router-comparison, credential-denial, system-run, system-scores |
   | G. Handoffs and escalation | Escalation rules R1 to R6 in tested code; transcripts per rule; handoff package | escalation-rules, handoff-and-escalation, escalation-failure-transcripts, system-run-step-g |
   | H. Mixed requests | Plan-mode design, planner dry run, decomposition run and scores, v2 fix, timing table, independence analysis | plan-mode-router-decomposition, planner-dry-run-criteria, planner-dry-run-v1, planner-dry-run-v1-review, system-run-decompose, system-decompose-scores, system-run-v2-check, system-v2-check-scores, timing-parallel-vs-sequential, subtask-independence-and-timing |
   | I. Failure injection | 11 failures plus 3 router-side; two hang defects and one latency defect found and fixed | failure-injection-plan, failure-injection-log (four runs), failure-injection-summary, failure-injection-router-plan, failure-injection-router-log (two runs), failure-injection-router-summary |
   | J. Product and governance | Jobs to Be Done, RICE (it does not reproduce the build order), ISO 42001 register and 13 risks | jtbd-and-rice, iso42001-register |

   ## Headline results

   | | Correct (of 21) | Invented | Escalation right |
   |---|---|---|---|
   | Layer 1, no tools | 5 | 2 | 18 |
   | Layer 2, fixed workflow | 16 | 0 | 18 |
   | Layer 3, agent loop | 18 | 0 | 19 |
   | Router and specialists | 16 | 0 | 21 |

   The system's 16 is scored against revised expectations for #7 to #10 (against the
   original column it is 15). It trades two correct answers for a smaller blast
   radius: each specialist reads only its own table.

   - 112 tests pass. Failure injection: 11 of 11 and 3 of 3 rows pass after fixes.
   - Running three subtasks in parallel took a median 7.5 s against 15.3 s in
     sequence (10 runs).
   - Failure injection found and fixed three defects: a single-path specialist that
     could hang the session (I1), classifier and planner calls with no time limit
     (I12), and an explicit human request that waited for the planner (I14).

   ## Open items

   - Not ready for real customers until R-04 (no per-customer scoping of order data)
     and R-09 (nothing receives the handoff packages) are treated. R-13 (no
     disclosure that the customer is talking to an AI system) belongs with them.
     See iso42001-register.
   - Planner v2 for the #17 contradiction and the dead-end referral (D1, D2). It
     needs a fresh 21-message dry run.
   - A live check with a real model after a tool error (I6b), and a generic tool
     error message (I6a).
   - Timed-out calls are not cancelled (I13).
   - Dependent subtasks (depends_on, when) are designed in the plan and not built.
   - #13 still ends without a route to a human (G3).
   - Week 5 revisits the register and the risk register.