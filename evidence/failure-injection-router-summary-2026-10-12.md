   # Router-side failure injection: summary (2026-10-12)

   Plan and predictions: evidence/failure-injection-router-plan-2026-10-12.md,
   committed before the first run. Script: agents/system/failure-injection-router.mjs.
   Instrument: the real dispatch, loop, specialists, planner, classifier,
   escalation rules and handoff builder. The model SDK and the database module are
   replaced by scripted stand-ins. This tests the system's mechanics. It does not
   show how a real model behaves when it is slow.

   ## Three runs

   | Run | Code | Log | Result |
   |---|---|---|---|
   | Before | dispatch.mjs with Promise.allSettled and no router limits (87a71f8) | failure-injection-router-log-2026-10-12-06-27-46.md | 0 of 3 |
   | After | dispatch.mjs with bounded router calls | failure-injection-router-log-2026-10-12-06-32-19.md | 3 of 3 |
   | Regression | the same fix, the original eleven rows | failure-injection-log-2026-10-12-06-32-22.md | 11 of 11 |

   The script was not changed between Before and After, so no control run was
   needed (for I1 the script had changed, which is why that one had a control).

   ## Result per row

   | # | Failure | Predicted | Before | After |
   |---|---|---|---|---|
   | I12a | The classifier call never returns | FAIL: hangs | FAIL: no result after 4000 ms | PASS: escalated, api_error, from the router, no specialist called, 1507 ms |
   | I12b | The planner call never returns, the classifier answers | FAIL: hangs | FAIL: no result after 4000 ms | PASS: resolved through the single path, raw message unchanged, 1503 ms |
   | I12c | A human request while the planner is slow (1200 ms) | FAIL: waits for the planner | FAIL: escalated correctly at 1206 ms | PASS: escalated at 0 ms |

   ## The fix

   - Each of the classifier and planner calls is bounded by routerTimeoutMs
     (default 30 s), using the helper the single path already uses.
   - The classifier alone decides R1, R2 and out_of_scope. The planner is only
     awaited at the step where a specialist is about to run. A slow or hung planner
     therefore cannot delay an explicit human request.
   - A planner that fails or times out falls back to the single path. A classifier
     that fails or times out is a router failure (R2: escalated, api_error).
   - A settle helper makes both calls non-rejecting, so a call nobody is waiting
     for any more cannot become an unhandled rejection.
   - 7 new tests in agents/system/dispatch-router-timeout.test.mjs. 112 pass.

   ## Reading

   - With the default limits every awaited stage of a session is bounded: the
     router phase by 30 s and the specialist phase by 60 s, so a session ends
     within about 90 s. This is derived from the code, not measured as one 90 s
     run. Each stage was shown separately (I12a, I12b, I1, I2).
   - Findings I12 and I14 are closed.

   ## Findings still open

   - I13: a timed-out call is not cancelled. The model SDK has no abort signal in
     this code, so an abandoned classifier, planner or specialist call keeps its
     request until the SDK or the network gives up. Its late result is ignored.
   - I6a: when a tool throws, the loop passes the raw exception text to the model
     as the tool result. It does not go to the customer directly, but the model can
     repeat it.
   - I6b: one tool error does not escalate: the rule needs two. With a real model a
     single malformed result ends in whatever the model writes. The scripted
     instrument cannot measure that.
   - The 30 s router limit is a judgement. The classifier took 1 to 2 s and the
     planner up to 6.6 s in the real runs. A planner slower than the limit costs
     only the split, never the answer.

   ## Limits

   - The model and the database are scripted. The slow and hung calls are exact, so
     the result shows the mechanics and not real network behaviour.
   - Module mocking is an experimental Node feature. Node 24 prints two deprecation
     warnings (defaultExport and namedExports have been renamed). The script works.
   - The assistant dry-ran the instrument and the fix in a sandbox before the
     project runs. The three logs above are from the project's own machine and are
     the record.