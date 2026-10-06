   # Subtask independence and timing: parallel against sequential (2026-10-06)

   Raw data: evidence/timing-parallel-vs-sequential-2026-10-06.md (script:
   agents/system/timing.mjs). Message: X1, the three-part request (status,
   decline, refund) for order 105, with a fixed plan so planner variance cannot
   change the comparison. Real specialists, real model calls. Only the subtask
   phase is timed. 5 runs per mode.

   ## Result

   | mode | median session ms | range ms | median sum of subtasks ms | median longest subtask ms | failed subtasks |
   |---|---|---|---|---|---|
   | parallel | 7470 | 5010 to 7634 | 15470 | 7470 | 0 |
   | sequential | 15331 | 11506 to 21883 | 15330 | 6873 | 0 |

   Parallel took about half the time of sequential (a saving of about 7.9 s on
   this message).

   Reading:
   - Parallel session time equals the longest subtask in every run (within 1 ms).
     Sequential session time equals the sum of the three in every run.
   - Per-subtask time did not rise when the three ran together (median sums
     15470 against 15330 ms), so three parallel loops caused no visible rate
     limiting or queueing.
   - The ordering held in every run: the slowest parallel session (7634 ms) is
     faster than the fastest sequential one (11506 ms).
   - Parallel saves time, not cost. The number of model calls is the same.

   ## Which subtasks are independent

   A subtask is independent when it needs only the order ID the code already
   holds, and no other subtask's result.

   | Message | Subtasks | Independent? | Why |
   |---|---|---|---|
   | #15 | decline, refund | yes | Each specialist reads its own table by order ID. |
   | #16 | order_status, refund | yes | Same. |
   | X1 | order_status, decline, refund | yes | Same, all three run at once. |
   | X2 | order_status (103), refund (104) | yes | Different orders, each with its own ID. |

   Every split in the test data is independent, so the scheduler runs everything
   in parallel and the timing above applies to all of them.

   ## Which would depend on another's result (not built)

   - A conditional: "Can I get a refund on order 102? If not, what state is it
     in?" The second question runs only if the first returns not_eligible. It
     needs the first verdict, so it runs after it and may be skipped.
   - A discovered ID: "refund my last order". The specialists have no tool that
     lists a customer's orders, so there is nothing to discover. Today this
     becomes a request for the order ID, not a dependency.
   - Escalation is not a dependency. If any subtask escalates, the whole session
     escalates after all subtasks finish (the combiner), so it does not delay
     the others.

   Dependent subtasks (depends_on and when) are designed in the plan
   (evidence/plan-mode-router-decomposition-2026-10-06.md) and deliberately not
   built: no message in the test set needs them, and the validator, scheduler
   and merge would each grow. They are a known gap.

   ## Limits

   - 10 runs of one message. Single subtasks varied from 3.4 to 10.5 s, so the
     medians are rough. The ordering between modes is the safe conclusion, not
     the exact saving.
   - Parallel ran first, then sequential. The first parallel run paid the first
     sign-in for each specialist. That would flatter sequential, not parallel.
   - Only the subtask phase is timed. The classifier and planner run first in
     both modes: about 4.2 s before the first subtask started in the
     decomposition run (#15).
   - The plan was fixed. A real session also pays for the planner call and for
     the merge, which is plain code.