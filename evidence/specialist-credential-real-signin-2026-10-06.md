   # Specialist credentials: real sign-in check (2026-10-06)

   Script: agents/smoke-db.mjs, using agents/lib/db.mjs. Each specialist signs in
   with its own Auth user and password, so the token carries its own
   principal_type claim. Then it counts rows in orders and payment_events.

   Run: node --env-file=.env agents/smoke-db.mjs

   ## Result

   | specialist | orders visible | payment_events visible |
   |---|---|---|
   | order_status | 13 | 0 |
   | refund | 13 | 20 |
   | decline | 0 | 20 |

   Same counts as the simulated-claims check in
   evidence/specialist-credential-scoping.md (2026-10-04). That check's limit
   "claims were simulated, not a real sign-in" is now closed.

   ## Known limits

   - Counts only. A targeted read of a specific row owned by another
     specialist's table is still to do in step F.
   - A denied read returns zero rows, not a permission error, because all
     specialists connect as the Postgres role `authenticated`.
   - These principals can read all customers' orders. They are not scoped to
     the customer in the current session.