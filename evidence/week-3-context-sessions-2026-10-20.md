# Week 3 step I: context and sessions in Claude Code (2026-10-20)

Model in the CLI: Opus 5.5. All runs were one run each, by hand, in fresh sessions started with `claude --tools "Grep,Glob,Read"` (plus Agent and Write for run B). The project MCP server was declined. Note: `--tools` limits only built-in tools; the session still showed 10 other MCP tools, and run A used an IDE tool once. So these were not strictly three-tool sessions.

## 1. Cold start: where is escalation decided?

Prompt: find where the decision to escalate a conversation to a human is made, using only the search tools.

Result: correct. It found agents/lib/escalation-rules.mjs, decideEscalation, the rules in order with their triggers, the callers (dispatch.mjs, combine.mjs, handoff-agent.mjs) and the older escalate_to_human path in Layer 3. It said what it had not opened (refund-rules.mjs, specialist allowlists).
Steps: 7 tool calls (3 Grep, 4 Read), self-reported. Context after: 17.8k tokens of messages, 28.5k total.
Labelling note: the session numbered the rules 1 to 7; our docs call them R1 to R6. Same code.

## 2. Larger exploration: main context versus subagent plus scratchpad

Task: map every place that touches payment_events (reads, writes, roles).

| | A: main context | B: subagent and scratchpad file |
| --- | --- | --- |
| Messages in the main window after | 31.9k tokens | 7.4k tokens |
| Added by the task | about 28.2k (baseline 3.7k) | at most 7.4k (no empty baseline measured) |
| Calls visible in the main session | 15 successful plus 4 failed | 1 (the Agent call) |
| Answer | role-by-role access matrix with line references and what was left out | condensed table, plus noise |

Findings:
- The subagent run used about 4 times fewer tokens in the main window.
- The scratchpad file (.scratch/payment-events-notes.md, 69 lines) held the real detail (search patterns, 28 files hit, exact grant and policy lines) that the returned table lost. The main session should read the notes on demand.
- Cost of the subagent: the main session could not list its calls, one role in the table was labelled "the subagent's guess", and two rows were noise (a hook file and a missing seed.sql). Less context, less audit trail.
- A safety flag fired on the subagent report because it mentioned .claude/settings.json. The main session treated it as data and changed nothing.
- Staff review screen reads raw payment_events rows with select *; noted for the register at step K.
- Run A's first attempt failed: Grep and Glob could not spawn (ripgrep). It declined to guess and said so; a retry worked after an update notice appeared. Cause not proven.
- The model's own count of its calls was off by one in run A. Use the on-screen count.
- Limits: one run each, different tool sets (system tools 4k versus 5.4k), no baseline for B.

## 3. Resume after a code change

Setup: session read escalation-rules.mjs and answered "2 errors, line 28". Outside the session, line 28 was changed from >= 2 to >= 3 (diff checked). The session was exited and resumed with `claude --continue`.
Result: asked without a hint, the resumed session answered "Two" from stored history with no tool call. It did not notice the change. It hedged only because it saw the file open in the editor.
Remedy tested: told to re-read from disk, it read the file, answered "Three", said its earlier answers were out of date, and pointed out that the repo rule requires a test for behaviour changes.
Reverted with git checkout; escalation tests 11 of 11 pass.

What to do when a resumed session does not notice:
- After any code change made outside the session, say so, or ask it to re-read the specific file from disk before answering.
- Do not ask it to answer from what it already knows about code that may have changed.
- For decisions that matter, prefer a fresh session or a subagent that reads the code now.
- Treat resumed history as a record of what was true when it was written.
