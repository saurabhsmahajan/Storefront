# ISO/IEC 42001 register update after Week 3: Storefront support agent (2026-10-20)

## Status and scope

- This file records the changes to `iso42001-register-2026-10-12.md` caused by Week 3. That file is kept unchanged as the Week 2 baseline. Where the two disagree, this file is newer.
- Same limits as before: a project-level register aligned to ISO 42001 concepts, not a certified management system, no claim of conformity. Annex A references stay at objective level.
- Ratings are the project owner's judgements from the evidence cited. Scale as before: likelihood 1 to 5 times impact 1 to 5; bands 1 to 4 low, 5 to 9 medium, 10 to 14 high, 15 to 25 critical.
- Lifecycle: still no production traffic and no real customers. Not ready for real customers (see section 5).
- Mechanism table (which rule is enforced by what): `week-3-mechanism-table-2026-10-14.md`.

## 1. Re-rated risks

| ID | Risk | Week 2 residual | Week 3 residual | Change |
|---|---|---|---|---|
| R-03 | A refund approved or promised without a human | 1x5 = 5 | 1x5 = 5 | none; control moved from absence of a tool to enforcement |
| R-04 | Anyone with an order ID can retrieve that customer's order data | 4x5 = 20 | MCP path 2x5 = 10; legacy path 4x5 = 20 | treated on one path only; system as built stays 20 |
| R-07 | A wrong answer after a tool error, with no escalation | 2x4 = 8 | 2x3 = 6 | down, one contributor closed |
| R-09 | Escalations that nobody receives | 5x4 = 20 | 4x4 = 16 | down, a receiver exists but nobody is told |
| R-11 | Card-related data in stored events, logs and evidence | 2x4 = 8 | 2x4 = 8 | none; exposure moved, not removed |

### R-03 A refund approved or promised without a human (A.6, A.9)
- Week 2 control: no tool could execute a refund.
- Week 3 controls: a stub `execute_refund` exists and a PreToolUse hook denies it unless a human approval is recorded for that order and a refund eligibility check succeeded first. The approval is created only by the review screen after a staff reviewer ticks the box. It is bound to a SHA-256 digest of the package and the raw records seen, expires after 30 minutes, and is single-use. A flag set in the model's own tool input does not count. Only `refund_recommendation` packages can be approved. Escalation, the handoff line and the authorisation state are written by code.
- Evidence: `week-3-hook-transcripts-2026-10-16.md`, `week-3-confirmation-flow-live-2026-10-16.md`, 11 hook tests and 9 review tests, the end-to-end test "denied, approved at the screen, allowed once, then denied again".
- Why the rating does not fall: the hook was proven offline and by scripted transcript. No live agent run was denied by it (F5). The control also replaced "no such tool exists", which is stronger by construction, with "a tool exists but is gated". Confidence in the control rose and the rating is unchanged.
- Still open: the model's free text could imply approval; the prompt bans it but code does not scan replies. Reviewer error is a new risk (R-16).

### R-04 Anyone with an order ID can retrieve that customer's order data (A.5.4, A.7, A.9)
- Week 3 controls on the MCP path: the three tools read only the signed-in customer's own rows. Another customer's order returns `not_found`, identical to an order that does not exist, so order IDs cannot be probed.
- Evidence: `week-3-mcp-server-calls-live-2026-10-14.md` (a real order of a different customer returns `not_found` on all three tools), `week-3-step-d-close-2026-10-14.md`, the SDK agent run using a customer token (`week-3-sdk-agent-scores-2026-10-16.md`).
- Why the rating splits: the older `dispatch.mjs` system still uses specialist credentials that read every customer's orders, and its chat accepts any order ID. The risk is treated only on the MCP and SDK path. Until the legacy path is retired or fenced, the system as built keeps 4x5 = 20 and still blocks production.
- Still open: payment reads are scoped in function code, not by row-level security, so a code mistake would not be caught by the database. The proof used one test customer and one other-customer order.

### R-07 A wrong answer after a tool error, with no escalation (A.6)
- Week 3 controls: MCP errors are structured (type, message, retryable, next action) and leak nothing. An unexpected bug becomes `internal` with no detail. This closes the Week 2 finding that raw exception text reached the model (I6a) on the MCP path. A hook denies out-of-order calls. A call that was allowed but never succeeded counts as one error, read from the hook log.
- Evidence: `week-3-tool-ordering-2026-10-14.md`, `week-3-mcp-server-design-2026-10-14.md`, hook tests.
- Why the rating falls: the raw error text no longer reaches the model on the MCP path, which lowers the impact of a wrong answer after an error.
- Still open: a single tool error still does not escalate (I6b). `upstream_unavailable` and `internal` were tested only with fakes. Error results skip the PostToolUse redaction hook, because the SDK delivers MCP errors to a different hook (F6).

### R-09 Escalations that nobody receives (A.3.2, A.9)
- Week 3 control: a local review screen is now a receiver. It opens a handoff package, shows the raw records the agent saw, and lets a staff reviewer approve an eligible refund recommendation. Only a staff principal can sign in to it.
- Evidence: `week-3-confirmation-flow-live-2026-10-16.md`, the screen capture.
- Why the rating falls but stays critical: the package now has somewhere to be opened. No person is notified, there is no queue, owner, response target or staffing, and the screen runs on one machine. The path after a customer answers "yes" to a human offer was never tested.
- Related finding: two test messages (#9 and #14) lost the human offer when the prompt banned the model from claiming a handoff (V1, not fixed).
- Status: open. Blocks production.

### R-11 Card-related data in stored events, logs and evidence (A.7)
- Week 3 controls: the MCP server omits payment fields. The redaction hook removes sensitive fields by name and removes the `authCode:last4:expiry` pattern under any field name before the model sees a result. The CI secrets scan and a local check cover keys.
- Why the rating does not fall: the exposure moved. Raw card fragments are visible to staff on the review screen. A committed screenshot (`week-3-confirmation-screen-2026-10-16.png`) shows seeded test card fragments and a user id. Error results skip redaction (F6). The conversation store keeps whatever tool result the host gives it, and nothing enforces that the result is already redacted.
- Treatment: mask card fragments on the review screen by default; pass only redacted bodies to the store and test that.

## 2. New risks created by Week 3

| ID | Risk | Inherent | Residual | Band |
|---|---|---|---|---|
| R-14 | Stored history carries a wrong provenance tag | 3x4 = 12 | 2x4 = 8 | medium |
| R-15 | Credentials exposed during setup or operation | 4x4 = 16 | 2x4 = 8 | medium |
| R-16 | One human approval is the only gate for money, and reviewers can read everything | 3x5 = 15 | 3x4 = 12 | high |
| R-17 | No retention or erasure rule for stored conversations | 4x3 = 12 | 4x3 = 12 | high |
| R-18 | Latency and cost of the agent path | 3x2 = 6 | 3x2 = 6 | medium |
| R-19 | Duplicated rules, and limits of the build pipeline | 3x3 = 9 | 2x3 = 6 | medium |

### R-14 Stored history carries a wrong provenance tag (A.6, A.7)
- Evidence: `week-3-conversation-state-design-2026-10-18.md`, `week-3-conversation-state-live-2026-10-18.md`, `week-3-append-only-trigger-test-2026-10-18.md`. Each message has a source tag. `verified` is a database-generated column, true only for tool and system rows, so model text cannot be stored as verified. A tool row must name its tool. The store has one typed method per source and no generic append. History is append-only, by permissions and by a trigger. The handoff builder reads only verified tool rows as findings.
- Residual: the database cannot know the true source. A bug or a compromised host could label text with the wrong tag. The handoff package does not yet read the store: `handoff-agent.mjs` still builds findings from the hook log.
- Treatment: wire the handoff to the store; code review of every call site of the typed methods.

### R-15 Credentials exposed during setup or operation (A.7, A.10)
- Incident, kept on purpose: during step H setup a Supabase secret key was pasted into a chat. It was replaced within minutes. A weak first password for the host identity was replaced. The shared test password is treated as compromised since Week 3 step D.
- Controls: `.env` is ignored by git and denied to Claude Code. A local check compares `.env` values with tracked files. CI runs a pattern scan on files and history, proven red on a fake key. The host identity has insert and read rights only; no service key is used at runtime.
- Residual: the pattern scan knows key shapes only. Setup scripts still need the secret key once. Human handling is the weak point.
- Treatment: rotate test credentials; delete test users and data listed in `week-3-step-d-close-2026-10-14.md`; never paste a key into a chat or terminal that is logged.

### R-16 One human approval is the only gate for money, and reviewers can read everything (A.3.2, A.9)
- Evidence: the review screen records the reviewer identity; staff policies let any staff principal read all orders, payment events and now all conversations.
- Risks: a reviewer who ticks without reading (automation bias); one reviewer decides alone; the approval is single-use but no one audits afterwards.
- Treatment: a second reviewer above a refund amount; an approval log with reviewer, time and digest; narrower staff read scope.

### R-17 No retention or erasure rule for stored conversations (A.7)
- Evidence: conversations and messages are append-only. Deletion is blocked except through a deliberate purge setting inside a privileged transaction. No retention period and no erasure procedure exist. Messages may hold personal data.
- Status: open. Needs a decision before real customers.

### R-18 Latency and cost of the agent path (A.6)
- Evidence: the SDK agent took 232.8 s for the 21 messages, about 1.9 times the 120.6 s of the Week 2 system. Cost was not measured. The SDK loop is capped at 8 turns, but no spend or token budget is set per conversation.
- Treatment: measure tokens and cost per conversation; set a budget and a timeout on the SDK path.

### R-19 Duplicated rules, and limits of the build pipeline (A.6, A.10)
- Evidence: the refund rules and the decline-reasons file exist in both the agents folder and the Edge Function. Tests fail if they drift, but a drift is possible between a test run and a deploy. CI (`week-3-ci-and-secrets-scan-2026-10-20.md`) runs formatting, 177 unit tests, the secrets scan and both failure-injection scripts, proven green and proven red on the secrets scan.
- Limits: actions are pinned by version tag, not commit hash. The failure-injection mocks use an experimental Node API that prints deprecation warnings. The non-zero exit of the failure-injection scripts was not proven by a failing run. CI does not run live tests.
- Treatment: pin actions by hash; update the mocks; add a failing-row proof.

## 3. Register additions

Common to the new entries: supplier and model as in the Week 2 register (A.10). One model constant for the agents (`agents/config.mjs`). Owner: the project owner.

### SYS-06 Storefront MCP server (tool interface)
- Intended use: give an agent three tools over HTTP, `get_order`, `get_payment_status` and `check_refund_eligibility`, each returning only fields its job needs.
- Code: `supabase/functions/storefront-mcp/index.ts` and `tools.ts`, deployed as an Edge Function. Project configuration in `.mcp.json` uses variable references only.
- Data and credentials (A.7): the caller's customer token proves who is asking. The function checks that the order belongs to that customer, then reads payments with a specialist login. Payment fields are omitted or tiered by the decline-reasons file.
- Controls: structured errors that leak nothing; an unknown order and another customer's order look identical; every tool description has a "Use for" and a "Not for" line; a hook enforces order of calls (an order lookup before a refund check).
- Oversight: recommends only. It has no tool that executes a refund.
- Impact (A.5.4): data exposure and wrong eligibility answers. Risk tier: high.
- Verification (A.6): `week-3-mcp-server-calls-live-2026-10-14.md`, `week-3-mcp-server-design-2026-10-14.md`, `week-3-mcp-tool-policies-2026-10-14.md`, `week-3-tool-ordering-2026-10-14.md`, `week-3-mcp-config-2026-10-14.md`.
- Known limits: one test customer and one other-customer order; payment scoping is in code, not row-level security; `upstream_unavailable` and `internal` tested with fakes only; duplicated rules (R-19).

### SYS-07 Agent SDK Router
- Intended use: classify the message, then let an SDK agent answer using the MCP tools, under hooks. It recommends and never approves.
- Code: `agents/router/sdk-router.mjs`, `hooks.mjs`, `handoff-agent.mjs`, `sdk-router-prompt.txt`.
- Data and credentials: the customer's token and the MCP server. It holds no database credential of its own.
- Controls: the classifier runs first, so a human request or a router failure escalates before any tool. Hooks enforce tool order, deny `execute_refund` without a recorded human approval, and redact sensitive fields before the model sees a result. Escalation rules R1 to R6 read the tool results from the hook log. Code builds and validates the handoff package: findings come from tool results, the agent note is labelled unverified, and the authorisation state is always "nothing approved".
- Oversight: a human approves every refund through the review screen.
- Impact: financial and personal data. Risk tier: high.
- Verification: `week-3-sdk-agent-scores-2026-10-16.md` (first run 20 of 21 correct, 1 invented, escalation right 17 of 21, 214.4 s; after the handoff fix 19 of 21 correct, 0 invented, escalation right 21 of 21, 232.8 s), `week-3-hook-transcripts-2026-10-16.md`.
- Known limits: messages #9 and #14 lack the human offer (V1); #7 borderline; hook blocking was proven offline, not by a live denial (F5); error results skip redaction (F6); one run per message on a hand-scored set; slower than the Week 2 system (R-18).

### Supporting controls added in Week 3 (not AI)
- Review screen (`agents/review/`): receiver and approval point for handoff packages; local only, with host, origin, token and content-security checks. Evidence: `week-3-confirmation-flow-live-2026-10-16.md`.
- Conversation store (`agents/state/`, migration `20261018100000_conversation_state.sql`): provenance-tagged, append-only history with row-level security. Evidence in R-14.
- Claude Code configuration: deny rules and hooks that protect secrets, plus the CI pipeline. Evidence: the mechanism table and `week-3-ci-and-secrets-scan-2026-10-20.md`.

## 4. Residual ratings after Week 3

| ID | Risk | Residual | Band | Change from Week 2 |
|---|---|---|---|---|
| R-01 | Invented facts about orders or payments | 2x3 = 6 | medium | none (SDK run: 0 invented; not re-scored here) |
| R-02 | Disclosure of fraud-screening detail or card fields | 1x4 = 4 | low | none |
| R-03 | A refund approved or promised without a human | 1x5 = 5 | medium | none |
| R-04 | Anyone with an order ID can retrieve that customer's order data | 4x5 = 20 (system); 2x5 = 10 (MCP path) | critical | split |
| R-05 | Prompt injection or instruction override | 2x4 = 8 | medium | none; customer text is now labelled unverified in stored history, not re-tested |
| R-06 | A session that never ends | 1x3 = 3 | low | none |
| R-07 | A wrong answer after a tool error, with no escalation | 2x3 = 6 | medium | down from 8 |
| R-08 | Dependence on one third-party model | 3x3 = 9 | medium | none |
| R-09 | Escalations that nobody receives | 4x4 = 16 | critical | down from 20 |
| R-10 | Inconsistent splits and contradictory merged replies | 3x2 = 6 | medium | none |
| R-11 | Card-related data in stored events, logs and evidence | 2x4 = 8 | medium | none |
| R-12 | Claims that outrun the evidence | 3x3 = 9 | medium | none |
| R-13 | The customer is not told they are talking to an AI system | 5x2 = 10 | high | none, parked |
| R-14 | Stored history carries a wrong provenance tag | 2x4 = 8 | medium | new |
| R-15 | Credentials exposed during setup or operation | 2x4 = 8 | medium | new |
| R-16 | One human approval is the only gate for money, and reviewers can read everything | 3x4 = 12 | high | new |
| R-17 | No retention or erasure rule for stored conversations | 4x3 = 12 | high | new |
| R-18 | Latency and cost of the agent path | 3x2 = 6 | medium | new |
| R-19 | Duplicated rules, and limits of the build pipeline | 2x3 = 6 | medium | new |

## 5. Open items

- Still not ready for real customers. Blocking: R-04 (fence or retire the legacy path), R-09 (notification, queue, owner), R-13 (disclosure line), and a decision on R-17.
- Before any real data: mask card fragments on the review screen (R-11), wire the handoff to the stored provenance tags (R-14), set a spend budget (R-18).
- Housekeeping: delete the test customer and test order, rotate test credentials, remove the reviewer test account and the reassigned seed-order ownership (R-15).
- Week 5 review: re-score on any model change, check Annex A references against the official text, review the supplier's terms.
