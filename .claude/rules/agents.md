---
paths:
  - "agents/**"
---

# Agents

- Node ESM `.mjs`. Every behaviour change needs a test in a sibling `*.test.mjs`.
- Timeouts: 30 s router, 60 s specialist. Do not raise without a recorded reason.
- Tools that move money are never exposed to the model without an approval flag checked in a hook.
- Disclosure tiers come from `agents/data/decline-reasons.json`; unknown reasons are never told.
