# Timing: parallel against sequential (2026-10-06)

Model: claude-sonnet-5-5
Message: X1, the three-part request (status, decline, refund) for order 105, with a fixed plan so the planner's variance cannot change the comparison. Real specialists, real model calls. Only the subtask phase is timed: the classifier and planner run before it and are the same in both modes.
Runs: 5 per mode, parallel first, then sequential (concurrency 1). Script: agents/system/timing.mjs.

| mode | median session ms | range ms | median sum of subtasks ms | median longest subtask ms | failed subtasks |
|---|---|---|---|---|---|
| parallel | 7470 | 5010 to 7634 | 15470 | 7470 | 0 |
| sequential | 15331 | 11506 to 21883 | 15330 | 6873 | 0 |

Per run:

| mode | run | session ms | subtask ms (s1, s2, s3) | sum | longest | failed |
|---|---|---|---|---|---|---|
| parallel | 1 | 7470 | 7470, 5697, 5392 | 18559 | 7470 | 0 |
| parallel | 2 | 5867 | 4728, 5866, 3432 | 14026 | 5866 | 0 |
| parallel | 3 | 7591 | 3548, 7591, 4331 | 15470 | 7591 | 0 |
| parallel | 4 | 5010 | 5010, 4506, 4505 | 14021 | 5010 | 0 |
| parallel | 5 | 7634 | 6887, 7634, 3639 | 18160 | 7634 | 0 |
| sequential | 1 | 21883 | 6228, 5204, 10451 | 21883 | 10451 | 0 |
| sequential | 2 | 15331 | 6873, 3922, 4535 | 15330 | 6873 | 0 |
| sequential | 3 | 17920 | 7040, 7447, 3433 | 17920 | 7447 | 0 |
| sequential | 4 | 11506 | 3611, 3890, 4005 | 11506 | 4005 | 0 |
| sequential | 5 | 11611 | 4174, 3966, 3470 | 11610 | 4174 | 0 |
