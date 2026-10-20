# Week 3 step J: CI and secrets scan (2026-10-20)

## What was added
- .github/workflows/ci.yml: runs on every push and pull request, read-only permissions, no secrets. Steps: checkout (full history), Node setup from .nvmrc (pinned 24.11.0), npm ci (root and agents), Prettier check, secrets scan (files and history), unit tests, failure injection (system rows, router rows).
- scripts/scan-secrets.mjs and tests: fail on known key shapes (Supabase secret key and legacy JWT, Anthropic, OpenAI-style, GitHub, AWS, Adyen API key, private key block). Prints pattern and location, never the value.
- The two failure-injection scripts ended with process.exit(0) always, so CI would have passed even with a failed row. They now exit 1 when any row fails.

## Passing run
https://github.com/saurabhsmahajan/Storefront/actions/runs/39417936884
Branch main, commit 39a225c, success, 33 s. Local result before the push: 177 of 177 unit tests, formatting clean, failure injection 11 of 11 and 3 of 3, scan passed on files and history.

## Deliberately failing run
https://github.com/saurabhsmahajan/Storefront/actions/runs/39418740620
Branch ci-fail-proof, commit f1251eb: one file with an obviously fake key (sb_secret_ followed by FAKE and zeros). Failed in 21 s at step 7, "Secrets scan (files and history)". Log:

    Secrets scan FAILED: 1 match(es). Values are not printed.
      Supabase secret key  ci-fake-key-test.txt:1

The branch was deleted afterwards and never merged.

## Limits and open items (for the register at step K)
- The scan knows key shapes only. A random password with no recognisable shape is not caught; the local .env check covers that on a machine with a .env.
- Actions are pinned by version tag (checkout@v4, setup-node@v4), not by commit hash. GitHub warns they target Node 20 and are forced to Node 24.
- Node 24 prints deprecation warnings for how the failure-injection mocks are written (defaultExport, namedExports). Works today; will need updating.
- The non-zero exit of the failure-injection scripts on a failed row was not proven by a failing run. Only the secrets scan has a proven red path.
- CI does not run live tests (state-live.mjs, credential-denial-test.mjs) or build the frontend: they need real credentials or a database.
- The fake-key commit may remain in GitHub's object store until garbage collection, although no branch points to it.
- Local Prettier flags .claude/settings.local.json; it is untracked and ignored by a global git rule, so CI never sees it.
