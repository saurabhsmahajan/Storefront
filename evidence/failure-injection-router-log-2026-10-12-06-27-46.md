# Failure injection log, router side (2026-10-12-06-27-46)

Plan and expectations: evidence/failure-injection-router-plan-2026-10-12.md, committed before the first run.
Script: agents/system/failure-injection-router.mjs. Node v24.16.0.
Instrument: the real dispatch, loop, specialists, planner, classifier, escalation rules and handoff builder. The model SDK and the database module are replaced by scripted stand-ins. This tests the system's mechanics. It does not show how a real model behaves when it is slow.

| # | Failure | Predicted | Expected | Observed | Result |
|---|---|---|---|---|---|
| I12a | The classifier call never returns | FAIL: the session hangs | Escalated within routerTimeoutMs, trigger api_error, package from the router, no specialist called | no result after 4000 ms: the session hangs | FAIL |
| I12b | The planner call never returns (the classifier answers) | FAIL: the session hangs | The single path runs after routerTimeoutMs: resolved, the specialist receives the raw message unchanged | no result after 4000 ms: the session hangs | FAIL |
| I12c | An explicit human request while the planner is slow (1200 ms, not hung) | FAIL: the escalation waits for the planner | Escalated immediately: trigger explicit_human_request, under 600 ms, no specialist called | outcome=escalated route=human_request trigger=explicit_human_request from=router to=human steps=0 ms=1206 specialists called=0 | FAIL |

0 of 3 rows passed.
