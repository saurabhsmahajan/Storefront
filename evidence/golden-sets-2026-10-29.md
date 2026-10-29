# Golden sets (2026-10-29)

Week 4, step B. Four golden sets, written before any Week 4 prompt, model-tier or retrieval change, so later results are measured against fixed cases.

## Where they are

The files are in `agents/eval/golden/`, committed in git. The commit that adds them is the dated record. This note does not copy their contents, so there is one source of truth.

| Set | File | Cases | Held back |
| --- | --- | --- | --- |
| Order Status | order-status.json | 15 | OS-05, OS-10, OS-15 |
| Refund Eligibility | refund-eligibility.json | 16 | RF-05, RF-10, RF-15 |
| Decline Explainer | decline-explainer.json | 15 | DX-05, DX-10, DX-15 |
| Router | router.json | 25 | RT-05, RT-10, RT-15, RT-20, RT-25 |
| Total | | 71 | 14 |

## How the cases were built

- Sources: the 21 test messages from Week 2 and 3 (`evidence/test-set-2026-10-04.md`) plus new cases. Each case records its source.
- Router: the original 21 messages are unchanged and in the same order (RT-01 to RT-21), so the Router baseline stays comparable with Week 3. RT-22 to RT-25 are new.
- Decline Explainer: DX-01 to DX-04 use the revised expectations for #7 to #10 from `evidence/decline-disclosure-decision-2026-10-06.md`.
- Refund Eligibility: eight new cases test the policy corpus (`evidence/corpus-manifest-2026-10-29.md`): the missing accessories window, the vague "reasonable time", the partial refund and store credit conflict, the gift-card exception, the open chargeback, who approves, and the damaged final-sale item.
- Each case records the expected route, tools required, allowed and forbidden, whether escalation is required, the facts or policy clauses the answer must contain, and what it must not say.

## Held-back rule

Every fifth case by id in each set is held back, fixed before any scores existed. Held-back cases are never used to tune a prompt, and are reported separately so overfitting is visible.

## Open items

- Order age: facts are written without ages, except RF-01 (order 103 must be inside the 30-day window), flagged `depends_on_order_age`. Order 103 is close to passing 30 days. Re-seed the order dates, or fix an "as of" date, before the first golden run.
- Retrieval cases: eight Refund cases and DX-11 are flagged `requires_retrieval`. They cannot pass before `search_policy` exists (step G), and are expected to fail in the without-retrieval run.
- Tool lists: `tools_required` for order-based cases comes from the Week 3 run notes. Tighten it after the first run, and record any change here.
- Scoring: the route, tool and escalation checks are code. `must_contain` and `must_not` are scored by the judge in step H, checked against human labels.
- Judge-scored results are not directly comparable with the hand-scored Week 3 table (19 of 21 correct). Compare by case, not by total.
