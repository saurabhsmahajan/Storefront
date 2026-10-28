# Week 4 starting point (2026-10-28)

Week 4 results are measured against these values. Recorded before any Week 4 code.

## Code state

- Commit: `c5540d6` (Week 3 step G/L), on `main` and `origin/main`.
- Tag: `week-3-complete`, pushed to GitHub, points at `c5540d6`.
- CI: green. Run #5 (main, 2026-10-20) and run #6 (tag `week-3-complete`, 2026-10-28), 35 s each. Run #2 (`ci-fail-proof` branch) is the deliberate fake-key proof and is meant to fail.

## Tests

- Unit tests: 177 run, 177 pass, 0 fail, 0 skipped (`node --test "agents/**/*.test.mjs" "scripts/**/*.test.mjs"`). Up from 112 at the end of Week 2.

## Failure injection (working folder and clean clone)

Both scripts were run twice on 2026-10-28: once in the working folder and once in a fresh clone of `main` at `c5540d6` (`npm ci` in the root and in `agents`).

| Script | Working folder | Clean clone |
| --- | --- | --- |
| `agents/system/failure-injection.mjs` (system rows I1 to I11) | 11 of 11 pass | 11 of 11 pass |
| `agents/system/failure-injection-router.mjs` (router rows I12a to I12c) | 3 of 3 pass | 3 of 3 pass |

Logs from the working folder are saved in `evidence/`:
`failure-injection-log-2026-10-28-11-13-59.md` and `failure-injection-router-log-2026-10-28-11-14-38.md`.

## Week 3 Router score (21-message test set)

Taken from `evidence/week-3-sdk-agent-scores-2026-10-16.md`, the v2 rerun after the handoff fix (Agent SDK agent with code-owned escalation and handoff package). Not re-run on 2026-10-28.

| Measure | Value |
| --- | --- |
| Correct | 19 of 21 |
| Invented | 0 |
| Escalation right | 21 of 21 |
| Total time | 232.8 s (11.1 s mean per message) |

Known misses in that run: #9 and #14 (the expected human offer was missing, failure V1).

Caveats:

- One run, one model, hand-scored. Single cases (#7, #9, #14) can change between runs.
- Week 4 golden sets will be checked by code plus a judge, so their scores are not directly comparable with this hand-scored table. The comparison is by case, not by total.

## Known open items at the start of Week 4

- `npm audit` in `agents/` reports 5 vulnerabilities (3 moderate, 2 high). Not fixed, so the baseline stays unchanged. Feeds the Week 8 dependency audit.
- Test runs print deprecation warnings for `mock.module()` options (`defaultExport`, `namedExports`). Not failing; to be tidied later.
- Week 3 carry-over items are routed in the tracker (step A).
