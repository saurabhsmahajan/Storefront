# Week 3 step E (items 4 to 6): tool discovery and ordering (2026-10-14)

## Item 4: tool discovery
The three tools appear with the right descriptions. Live evidence: `week-3-mcp-server-calls-live-2026-10-14.md`, section "Tool list as the client sees it" (all three descriptions carry a "Use for" example and a "Not for" line, counted: 3). Claude Code also found and called the tools through `.mcp.json` (see `week-3-mcp-config-2026-10-14.md`).

## Item 5: ordering enforced in code
Rule: `check_refund_eligibility` may only run for an order after `get_order` has succeeded for that same order in the same session.
- Rule and tests: `agents/mcp/prerequisites.mjs`, `agents/mcp/prerequisites.test.mjs` (11 tests: blocked before lookup, allowed after, other order does not unlock, a failed lookup does not count, malformed input blocked, unrelated tools unaffected).
- Claude Code hook: `.claude/hooks/tool-prerequisites.mjs`, wired in `.claude/settings.json` (PostToolUse on `get_order` records a success; PreToolUse on `check_refund_eligibility` blocks with exit code 2). Unreadable hook input is also blocked.
- `tool_choice` is not available in the Agent SDK (no such option in the installed version, 0.3.289), so "force this tool first" is not an option there. Ordering has to be done by the hook. Step F reuses the same rule module as the Agent SDK PreToolUse hook.

## Item 6: transcripts
Run with Claude Code against the function running locally on a fake backend (not the deployed function). The model decides what to call, so another run may differ. Calls to the tool-loading helper are left out.

### Run 1: told to skip the lookup
```
CALL    check_refund_eligibility {"order_id": "5eed0000-0000-4000-8000-000000000101"}
RESULT  [blocked by hook] PreToolUse:mcp__storefront__check_refund_eligibility hook error: [node "$CLAUDE_PROJECT_DIR/.claude/hooks/tool-prerequisites.mjs"]: Blocked: check_refund_eligibility may only run after get_order has succeeded for order 5eed0000-0000-4000-8000-000000000101. Call get_order first.
CALL    get_order {"order_id": "5eed0000-0000-4000-8000-000000000101"}
RESULT  {"order_id":"5eed0000-0000-4000-8000-000000000101","status":"paid","total_minor":159900,"currency":"INR","ordered_at":"2026-10-09T12:32:51.344Z","age_days":5}
CALL    check_refund_eligibility {"order_id": "5eed0000-0000-4000-8000-000000000101"}
RESULT  {"order_id":"5eed0000-0000-4000-8000-000000000101","verdict":"eligible","reason":"within_window","facts":{"status":"paid","age_days":5,"window_days":30,"within_window":true},"recommendation_only":true}
```

### Run 2: an ordinary question
The model sent both calls at once. The dependent call was blocked because the lookup had not finished, then retried after it succeeded.
```
CALL    check_refund_eligibility {"order_id": "5eed0000-0000-4000-8000-000000000101"}
RESULT  [blocked by hook] PreToolUse:mcp__storefront__check_refund_eligibility hook error: [node "$CLAUDE_PROJECT_DIR/.claude/hooks/tool-prerequisites.mjs"]: Blocked: check_refund_eligibility may only run after get_order has succeeded for order 5eed0000-0000-4000-8000-000000000101. Call get_order first.
CALL    get_order {"order_id": "5eed0000-0000-4000-8000-000000000101"}
RESULT  {"order_id":"5eed0000-0000-4000-8000-000000000101","status":"paid","total_minor":159900,"currency":"INR","ordered_at":"2026-10-09T12:32:51.344Z","age_days":5}
CALL    check_refund_eligibility {"order_id": "5eed0000-0000-4000-8000-000000000101"}
RESULT  {"order_id":"5eed0000-0000-4000-8000-000000000101","verdict":"eligible","reason":"within_window","facts":{"status":"paid","age_days":5,"window_days":30,"within_window":true},"recommendation_only":true}
```

## Limits
- Both runs are against the local function with a fake backend.
- The hook records a lookup by order ID within a session. It does not check that the lookup belongs to the same customer; the function does that.
- State is a small file in the system temp folder, one per session. It is not cleaned up automatically.
- The rule is wired for Claude Code sessions. The Router built in step F must wire the same module itself.
