# Formatting-skip baseline (CLAUDE.md rule only, no hook)
Start date: 2026-09-28
Rule under test: "Run the formatter after every file edit."
Method: after each Claude Code edit, run `npx prettier --check .`
and log a row for each edit where the check fails.

| Date | File edited | Prettier check (pass/fail) | Did Claude run the formatter itself? |
|---|---|---|---|
| 2026-09-28 | supabase/migrations/20260928134509_init_schema.sql (update) | n/a — no SQL parser | yes (ran, errored) |
| 2026-09-28 | supabase/migrations/20260928134509_init_schema.sql (update 2) | n/a — no SQL parser | yes (ran, errored) |
| 2026-09-29 | frontend/src/supabaseClient.ts | pass | yes |
| 2026-09-29 | frontend/src/main.ts | pass | yes |
| 2026-09-29 | frontend/index.html (cart view elements) | pass | yes |
| 2026-09-29 | frontend/src/main.ts (cart feature) | pass | yes |
| 2026-09-30 | supabase/functions/create-checkout-session/index.ts | pass | yes |
| 2026-09-30 | supabase/functions/create-checkout-session/deno.json | pass | yes |
| 2026-09-30 | frontend/index.html (Adyen checkout button + dropin div) | pass | yes |
| 2026-09-30 | frontend/src/main.ts (Adyen Drop-in integration) | pass | yes |
| 2026-09-30 | frontend/package.json (added @adyen/adyen-web) | pass | yes |
| 2026-09-30 | frontend/src/main.ts (added countryCode to Adyen config) | pass | yes |
| 2026-09-30 | frontend/src/main.ts (registered Card component in Dropin config) | pass | yes |
| 2026-09-30 | supabase/functions/adyen-webhook/index.ts | pass | yes |
| 2026-09-30 | supabase/functions/adyen-webhook/deno.json | pass | yes |
| 2026-10-01 | .claude/hooks/format-on-edit.mjs | pass | yes |

## After: hook on (PostToolUse format-on-edit)
Start date: 2026-10-04
Method: after each Claude Code edit, run `npx prettier --check .`
and log a row for every edit. The hook is on, so I also log whether
the `format-on-edit:` line appeared in the output.

| Date | File edited | Prettier check (pass/fail) | Hook ran (yes/no) |
|---|---|---|---|
| 2026-10-04 | frontend/src/main.ts (comment added) | pass | yes |
| 2026-10-04 | frontend/index.html (p element added) | pass | yes |
| 2026-10-04 | supabase/functions/create-checkout-session/index.ts (console.log added) | pass | yes |
| 2026-10-04 | supabase/functions/adyen-webhook/index.ts (console.log added) | pass | yes |
| 2026-10-04 | supabase/functions/create-checkout-session/deno.json (description field added) | pass | yes |
| 2026-10-04 | frontend/package.json (description field added) | pass | yes |
| 2026-10-04 | frontend/src/main.ts (afterCountTestEdit7 function added) | pass | yes |
| 2026-10-04 | frontend/index.html (section added, edit 8) | pass | NO: hook failed, MODULE_NOT_FOUND (relative path resolved from frontend/) |
| 2026-10-04 | frontend/index.html (p element added after cd frontend, edit 9) | pass | yes, after the $CLAUDE_PROJECT_DIR path fix |
| 2026-10-04 | supabase/functions/adyen-webhook/index.ts (afterCountTestEdit10 added) | pass | yes |
| 2026-10-04 | supabase/functions/create-checkout-session/index.ts (afterCountTestEdit11 added after cd supabase) | pass | yes |
| 2026-10-04 | frontend/src/afterCountTest12.ts (new file: Write, then Edit) | pass | yes (both PostToolUse:Write and PostToolUse:Edit) |

Finding (2026-10-04): the PostToolUse hook used a relative path
(node .claude/hooks/format-on-edit.mjs). With Claude's shell inside
frontend/, node looked for frontend\.claude\hooks\format-on-edit.mjs and
failed with a non-blocking error (hook_non_blocking_error, exitCode 1).
Nothing showed in the terminal, and `prettier --check` still passed, so
the failure was silent. Fixed by using "$CLAUDE_PROJECT_DIR" in the
command. Verified by a hook_success entry for an edit made after Claude
ran `cd frontend` (PowerShell call recorded in the session transcript).
Not shown: the shell's working directory at the moment the hook fired.

   ## Summary (2026-10-04)

   | Phase | Dates | Edits | Prettier failures | Hook ran |
   |---|---|---|---|---|
   | Before: CLAUDE.md rule only, no hook | 2026-09-28 to 2026-10-01 | 16 (14 checked, 2 SQL n/a) | 0 | n/a |
   | After: hook on | 2026-10-04 | 12 | 0 | 11 of 12 (edit 8 failed, path bug, fixed) |

   Reading: rule compliance held in both phases, so the hook did not reduce
   skips from a nonzero baseline. What the hook adds is enforcement by code.
   The after phase also found a silent hook failure (relative path, edit 8)
   that prettier --check did not reveal, because the output was already
   formatted. Hook runs were verified from the session transcript, not the
   terminal. Both Edit and Write tools were exercised.