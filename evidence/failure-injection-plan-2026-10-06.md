   # Failure injection plan (2026-10-06)

   Written before any injection is run. One row per failure. For each, the
   expected outcome is stated first. The log of results comes after, in a
   separate file. Pass means the session ended resolved or escalated with a
   valid handoff package and no wrong answer presented as right.

   Rule under test: every session ends in a resolution or a human escalation,
   never a hang and never a silent wrong answer.

   | # | Failure | Injected where | Expected outcome | Why |
   |---|---|---|---|---|
   | I1 | A tool call that never returns | order_status specialist, single path | UNKNOWN, predicted FAIL: the session hangs | The single path has no timeout. Only the split path's scheduler sets one. |
   | I2 | A tool call that never returns | the same specialist, split path | Escalated, trigger specialist_error, within timeoutMs | The scheduler times the subtask out. |
   | I3 | A lookup that finds nothing where an order was expected | order_status, found false for a real order ID | Resolved, the reply says the order was not found, no status invented | The specialist is told to say so. |
   | I4 | A lookup that finds nothing | refund, no order | Resolved, reply says it could not find the order | verdict not_found, no escalation. |
   | I5 | Malformed tool output: a payment event with no payload | decline specialist | Resolved or escalated, no crash, no raw reason shown | The mapping must tolerate a missing reason: unknown reasons default to never_tell. |
   | I6 | Malformed tool output: the lookup returns a string, not an object | order_status | No crash. Escalated or an honest "I couldn't read it". | UNKNOWN: the code reads fields from the result. |
   | I7 | A specialist that returns nothing (undefined) | any specialist, single path | Escalated, a valid package | UNKNOWN: dispatch reads fields on the result. |
   | I8 | A specialist whose final reply is empty | any specialist | Escalated, trigger empty_reply, FALLBACK_REPLY | The loop forces an escalation on an empty final reply. |
   | I9 | A model API error inside a specialist loop | refund specialist | Escalated, trigger api_error | The loop catches API errors. |
   | I10 | A model API error in the planner | planner | Single path runs as today, resolved | The planner failing falls back to the single path. |
   | I11 | A model API error in the planner and the classifier | both | Escalated, trigger api_error, steps 0 | The classifier failing is R2. |

   Rows marked UNKNOWN are the ones I cannot predict from reading the code. If a
   row fails, the fix is made in a new commit and the row is rerun, so the log
   shows both results.