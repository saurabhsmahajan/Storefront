# Week 3 step B: starting point (2026-10-14)

Taken from a fresh clone of github.com/saurabhsmahajan/Storefront, with `npm ci` run in `agents/` and no `.env` file. CI (step J) is to protect this baseline.

## Baseline

| Item | Value |
|---|---|
| Commit | 94fe3fa (tag `week-2-complete`, main) |
| Node | v22.22.0 (the Week 2 failure-injection runs on the project machine used Node 24, so step J must pin one version) |
| Unit tests | 112 of 112 pass, about 9 s |
| Failure injection, specialist path | 11 of 11 rows pass |
| Failure injection, router side | 3 of 3 rows pass |

## Commands that produced it

- Unit tests: `node --experimental-test-module-mocks --test "agents/**/*.test.mjs"`
- Failure injection: `node --experimental-test-module-mocks agents/system/failure-injection.mjs`
- Router-side failure injection: `node --experimental-test-module-mocks agents/system/failure-injection-router.mjs`

## Notes

- The `test` script in `package.json` is still a placeholder that exits with an error. CI must call the commands above directly, or the script should be fixed in step J.
- Both failure-injection scripts replace the model SDK and the database with scripted stand-ins, so they need no API key and spend nothing. Each run saves a dated log file under `evidence/`, which shows up as an untracked file after a run. CI should not commit those logs.
- The scripted rows do not show how a real model behaves. See the limits in `failure-injection-summary-2026-10-12.md`.
