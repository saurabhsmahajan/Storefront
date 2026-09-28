# Formatting-skip baseline (CLAUDE.md rule only, no hook)
Start date: 2026-09-28
Rule under test: "Run the formatter after every file edit."
Method: after each Claude Code edit, run `npx prettier --check .`
and log a row for each edit where the check fails.

| Date | File edited | Prettier check (pass/fail) | Did Claude run the formatter itself? |
|---|---|---|---|