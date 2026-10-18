# Week 3 step H: conversation state design

## Decisions
- The API is stateless, so the host stores every turn in Postgres and rebuilds the history on each call.
- Every message has a provenance: customer, tool, model, human, system.
- `verified` is a generated column (true only for tool and system). No client can write it, so model text cannot be stored as verified.
- A tool row must name its tool, and no other row may (CHECK constraint), so model text cannot pose as a tool result without a tool name.
- The store has one typed method per source and no generic append, so the tag is chosen by code at the call site.
- History sent to the model carries the label in the text: "[tool result: x, verified]" versus "[customer says, unverified]". The model's own earlier words are replayed as assistant turns.
- The handoff package reads the tags: findings only from verified tool rows; the latest model text is the unverified agent note.
- Writer: a dedicated host identity (principal_type agent_host) with insert and select only. No service key at runtime.
- Readers: the owning customer, staff reviewers, and the host.
- Append-only: a trigger blocks update and delete. A deliberate purge needs `storefront.allow_history_purge = 'on'` inside its own transaction.

## Limits and risks (for the register at step K)
- A compromised host could still label text with the wrong provenance; the database cannot know the true source. Mitigation: typed methods, code review, tests.
- Customer text is stored as written and replayed to the model labelled unverified. That reduces, but does not remove, injection risk.
- The append-only rule conflicts with erasure requests; a privileged purge procedure is needed before real customers.
- Staff can read every conversation.
- Conversation content may contain personal data; retention is not defined yet.
- The live test scripts the calls and does not call a model.
