# StoreFront

Supabase ecommerce backend with an agentic customer-support system (Router plus specialist agents). Guidance below is advisory. Anything that must always hold is enforced in `.claude/settings.json` (permissions, hooks), not here.

## Stack

- Supabase (Postgres, Edge Functions on Deno) in `supabase/`
- Agents in `agents/` (Node ESM `.mjs`, Claude Agent SDK, MCP SDK, zod)
- Evidence of every test run in `evidence/`

## Commands

- Tests: `node --experimental-test-module-mocks --test "agents/**/*.test.mjs"`
- Failure injection: `node --experimental-test-module-mocks agents/system/failure-injection.mjs` and `agents/system/failure-injection-router.mjs`
- Node 22 is the baseline.

## Working agreements

- Database changes are made by the owner through the Supabase CLI. Do not hand-write migrations; give the commands instead.
- Record what was tested and the result in `evidence/` with the date. Say plainly what failed.

## Tool policies

@evidence/week-3-mcp-tool-policies-2026-10-14.md
