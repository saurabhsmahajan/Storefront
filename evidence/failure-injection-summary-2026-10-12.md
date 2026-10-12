   # Failure injection: summary (2026-10-12)

   Plan and expectations: evidence/failure-injection-plan-2026-10-06.md, committed
   before any run (25f3b3a). Script: agents/system/failure-injection.mjs.
   Instrument: the real dispatch, loop, specialists, planner, classifier,
   escalation rules and handoff builder. The model SDK and the database module are
   replaced by scripted stand-ins, so each failure is exact and repeatable. This
   tests the system's mechanics. It does not show how a real model words a reply
   after a failure.

   ## Three runs

   | Run | Code | Script | Log | Rows passed |
   |---|---|---|---|---|
   | 1, before | old dispatch.mjs | original | failure-injection-log-2026-10-10-07-28-30.md | 10 of 11 |
   | Control | old dispatch.mjs | with timeoutMs: 1500 in I1 | failure-injection-log-2026-10-12-06-20-25.md | 10 of 11 |
   | 2, after | fixed dispatch.mjs | with timeoutMs: 1500 in I1 | failure-injection-log-2026-10-12-06-18-12.md | 11 of 11 |

   The control exists to show that the one-line change to the script is neutral.
   Before the fix the single path ignored deps.timeoutMs, so I1 hangs with or
   without it. It did: the control hangs. The fix is what made I1 pass.

   ## Result per row

   | # | Failure | Predicted | Before | Control | After |
   |---|---|---|---|---|---|
   | I1 | A tool call that never returns (single path) | FAIL: hangs | FAIL: no result after 4000 ms | FAIL: same | PASS: escalated, specialist_error, 1507 ms |
   | I2 | The same, split path | PASS | PASS | PASS | PASS (1515 ms, one part unanswered) |
   | I3 | Lookup finds nothing (order status) | PASS | PASS | PASS | PASS (model shown exactly {"found":false}) |
   | I4 | Lookup finds nothing (refund) | PASS | PASS | PASS | PASS (verdict not_found, no package) |
   | I5 | Malformed payment events | PASS | PASS | PASS | PASS (4 attempts, all generic, no raw reason) |
   | I6 | Malformed order lookup (a string) | UNKNOWN | PASS: tool_failure | PASS | PASS |
   | I7 | A specialist returns nothing | UNKNOWN | PASS: specialist_error via the outer catch | PASS | PASS |
   | I8 | A specialist's final reply is empty | PASS | PASS: empty_reply | PASS | PASS |
   | I9 | A model API error inside a specialist loop | PASS | PASS: api_error | PASS | PASS |
   | I10 | A model API error in the planner only | PASS | PASS: single path, raw message unchanged | PASS | PASS |
   | I11 | A model API error in the planner and classifier | PASS | PASS: api_error from the router, no steps | PASS | PASS |

   ## The fix (I1)

   The split path already timed subtasks out through the scheduler. The single
   path, which handles most messages, had no time limit: a specialist that never
   returned blocked the session indefinitely. dispatch.mjs now wraps the
   single-path specialist call in withTimeout, using deps.timeoutMs with the same
   60 s default as the split path. A timeout becomes a specialist_error
   escalation with a validated package and the fixed fallback reply. Tests 19 to
   21 in dispatch.test.mjs: a never-returning specialist escalates, a late result
   changes nothing, a specialist inside the limit is unaffected. 105 tests pass.

   ## Findings (open)

   - I12 (not in the plan): the classifier and planner calls have no time limit of
     their own. They rely on the model SDK's default timeout, which is long, and
     this was not tested. Same defect class as I1, on the router side. A hanging
     classifier would block a session before any specialist runs.
   - I13: withTimeout does not cancel the hung work, because the loop has no
     abort signal. The late result is ignored (test 20), but each hung call keeps
     its request and promise until the SDK or the network gives up.
   - I6a: when a tool throws, the loop passes the raw exception text to the model
     as the tool result (here: "Cannot read properties of undefined (reading
     'slice')"). It does not go to the customer directly, but the model can
     repeat it. Candidate: replace tool errors with a generic message.
   - I6b: one tool error does not escalate: the rule needs two. With a real model,
     a single malformed result ends in whatever the model writes. The scripted
     instrument cannot measure that. Candidate: a live check with a real model.

   ## Limits

   - The model and the database are scripted. Replies written by a real model
     after a failure were not measured. The earlier real-model runs (#6 not found;
     the R4 transcript in Step G) are the only evidence of that.
   - API errors are an Error("529 overloaded_error") thrown by the stand-in, not a
     real HTTP failure. A real rate limit (429) and the SDK's own retries were not
     exercised.
   - The script uses node:test module mocking, which is experimental. Node 24
     prints two deprecation warnings (defaultExport and namedExports have been
     renamed to exports.default and exports). The script still works.
   - The assistant dry-ran the script in a sandbox before the project runs. The
     three logs above are from the project's own machine and are the record.
   - I6 and I7 were UNKNOWN in the plan and passed. They were not predicted to
     pass, so the plan did not anticipate them.