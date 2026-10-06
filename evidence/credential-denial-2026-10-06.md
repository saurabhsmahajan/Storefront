   # Credential denial test: targeted reads and a write (2026-10-06)

   Script: agents/credential-denial-test.mjs. Each specialist signs in with its
   own Auth user (real sign-in, not simulated claims), then tries to read one
   known order (order 103), read one known payment event (SEEDFAIL107A), and
   update order 103's status to the value it already has ("paid").
   Run: node --env-file=.env agents/credential-denial-test.mjs
   Policies: supabase/migrations/20261004150711_specialist_agent_policies.sql

   ## Result

   | specialist | read order 103 | read event SEEDFAIL107A | write order 103 |
   |---|---|---|---|
   | order_status | 1 row | 0 rows (denied) | 0 rows (denied) |
   | refund | 1 row | 1 row | 0 rows (denied) |
   | decline | 0 rows (denied) | 1 row | 0 rows (denied) |

   Order 103's status after the run: paid.

   Reading: the allowed reads return the row, which proves the rows exist, so
   the zero-row results are denials and not missing data. Each specialist is
   blocked from the other's table. None of them can change an order.

   ## Known limits

   - A denied read or write returns zero rows, not a permission error: all
     specialists connect as the Postgres role `authenticated`, and RLS filters
     rows silently. An error-level denial would need a separate Postgres role
     per specialist.
   - The write denial rests on RLS alone. The column grant on orders
     (update on status) allows `authenticated` to attempt the update, and only
     the staff update policy would let it through.
   - The write used the order's current value ("paid"), so the status after the
     run cannot show whether a write happened. The zero-row result on the
     update is what shows no row was changed.
   - No positive control for the write: a staff credential updating the same
     row was not run.
   - Only reads and an update were tried. Insert and delete were not.
   - These principals can read all customers' orders. They are not scoped to
     the customer in the current session.