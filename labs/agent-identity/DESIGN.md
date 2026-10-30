# Agent identity lab: design note

Hands-on build with synthetic data. Not employer production work.

## Goal

Show that delegation from shopper agent to order agent to payment agent
must narrow at every hop, and that the payment agent can never refund.

## Rules

1. Each agent has its own identity (SPIFFE-style name, simulated).
2. Every hop gets a token narrower than the one before.
3. The payment agent holds no refund scope. Refunds need a human.

## Planned tokens

| Token             | Audience      | Allowed                                                   | Not allowed    |
| ----------------- | ------------- | --------------------------------------------------------- | -------------- |
| Sam's login token | shopper agent | catalog:read, order:create, order:read, refund:request    | payment:*      |
| Shopper to order  | order agent   | order:create, order:read, refund:request, order 1042 only | other orders   |
| Order to payment  | payment agent | payment:charge, order 1042, once                          | payment:refund |

## Tests we expect to pass later

- Refund relay: the payment agent refuses.
- Wrong audience, expired token and replayed token are all refused.
- A revoked agent's tokens stop working.
- A hop wider than its parent is flagged by the audit check.

## Decision: how agents prove who they are

Date: 2026-10-30
Choice: each agent holds its own key pair and proves its identity to the token
issuer with a signed assertion. Its SPIFFE-style name goes in the sub claim.
Why: runs on Windows with Node only, no shared secret, and keeps the token
exchange logic visible.
Trade-off: this simulates workload identity. In production, SPIRE or a cloud
identity service issues and rotates these identities and attests the workload.
Risk accepted: private keys sit on disk in the lab. Fine for synthetic data,
not for production. Revisit if the lab is extended to run real SPIRE.
