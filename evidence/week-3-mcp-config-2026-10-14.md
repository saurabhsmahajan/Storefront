# Week 3 step E: MCP configuration (2026-10-14)

## What is committed
`.mcp.json` at the repo root (project scope, shared through git). One server, `storefront`, type `http`. It holds no secret: the URL is `${STOREFRONT_MCP_URL}` and the header is `Authorization: Bearer ${STOREFRONT_CUSTOMER_JWT}`. Each person sets those two variables in their own shell.

## Tests run
| Test | Result |
|---|---|
| Claude Code started with both variables set, against the function running locally on a fake backend: asked to call `get_order` | The call worked. Claude Code reported the order as paid, 5 days old. Variables expanded in both the URL and the header |
| Claude Code started with both variables unset | The server failed to connect with `INVALID_CONFIG: 'url' is not a valid URL`. No tools were available. It fails visibly and does not fall back to anything |
| `scripts/check-env-values-not-committed.mjs` in a throwaway repo, clean | Passed, exit 0 |
| Same script after planting one `.env` value in a tracked file | Failed, exit 1, named the variable and file, did not print the value |

## Scopes in this project
- Project scope (`.mcp.json`, in git): shared server definitions, `${VAR}` references only.
- User scope (private to one person, not in git): personal experiments. Add one with `claude mcp add --scope user <name> ...`. Nothing in this repo should hold a user-scope server.

## Limits
- The two tests with Claude Code ran against the local function with a fake backend, not the deployed function.
- The customer token expires after about an hour, so `STOREFRONT_CUSTOMER_JWT` must be refreshed. This is a developer set-up, not how a real customer session would pass its token.
- Claude Code asks for approval the first time it sees a project-scope server. That approval is per person.
- The scanner only checks values in the local `.env`. It does not find secrets that are not in that file. A general scan is part of step J.
