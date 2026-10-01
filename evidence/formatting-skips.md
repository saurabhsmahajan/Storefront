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
