   # Failure injection plan, router side (2026-10-12)

   Written and committed before the first run of these rows. Follows
   evidence/failure-injection-summary-2026-10-12.md, which logged finding I12 and
   left it open.

   ## What dispatch.mjs does today (read before predicting)

   `await Promise.allSettled([classify(message), plan(message)])`. Two defects:

   - I12: neither call has a time limit of its own. They rely on the model SDK's
     default timeout, which is long, and that was never tested.
   - I14: allSettled waits for both calls before anything is decided. A slow
     planner therefore delays an explicit human request (R1), a no-label router
     (R2) and an out-of-scope reply, even though the classifier alone decides
     them. The Week 2 file says a human request is honoured immediately.

   ## Rows and predictions

   | # | Failure | Injected | Predicted | Expected after the fix |
   |---|---|---|---|---|
   | I12a | The classifier call never returns | real classifier, model call never resolves | FAIL: the session hangs | Escalated within routerTimeoutMs, trigger api_error, package from the router, no specialist called |
   | I12b | The planner call never returns, the classifier answers | real planner, model call never resolves | FAIL: the session hangs | The single path runs after routerTimeoutMs: resolved, the specialist receives the raw message unchanged |
   | I12c | An explicit human request while the planner is slow (1200 ms, not hung) | slow planner stub | FAIL: the escalation waits about 1200 ms for the planner | Escalated immediately: explicit_human_request, under 600 ms, no specialist called |

   Predictions are made from reading the code, not from running it.

   ## Intended fix (not applied yet)

   - Bound each call with a time limit, routerTimeoutMs, default 30 s, using the
     same helper the single path already uses.
   - Decide R1, R2 and out_of_scope from the classifier alone. Await the planner
     only once a specialist is about to run.
   - A planner that fails or times out falls back to the single path, as today.
     A classifier that fails or times out is a router failure (R2).

   ## Limits

   - The model and the database are scripted. This shows the mechanics, not how a
     real model behaves when it is slow.
   - The 30 s default is a judgement. The classifier took 1 to 2 s and the planner
     up to 6.6 s in the real runs. A planner slower than the limit costs only the
     split, never the answer.
   - A timed-out call is not cancelled: the model SDK has no abort signal in this
     code, so an abandoned call keeps its request until the SDK or the network
     gives up (same as finding I13).