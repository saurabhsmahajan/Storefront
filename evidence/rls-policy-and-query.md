# RLS evidence: same tables, different principals (2026-10-04)

Source: supabase/migrations/20260928134509_init_schema.sql
RLS is enabled on products, carts, cart_items, orders and payment_events.
Staff and agent both connect as the Postgres role `authenticated`. The
policies tell them apart by the JWT claim app_metadata.principal_type.

## Policies compared

```sql
-- orders: staff and agent read all.
create policy orders_select_staff_agent
  on public.orders for select
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'principal_type') in ('staff', 'agent'));

-- payment_events: staff read only.
create policy payment_events_select_staff
  on public.payment_events for select
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'principal_type') = 'staff');
```

## Query (run in the Supabase SQL editor, once per principal)

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"principal_type":"<staff|agent>"}}',
  true);
select
  (select count(*) from public.orders) as orders_visible,
  (select count(*) from public.payment_events) as payment_events_visible;
rollback;
```

## Results

| principal_type | orders_visible | payment_events_visible |
|---|---|---|
| staff | 5 | 3 |
| agent | 5 | 0 |

Reading: the table is not empty (staff sees 3 payment_events rows), so the
agent's 0 is the policy blocking the read, not missing data. Orders are
visible to both, as the policy intends.

## Known limits

- Claims were simulated with set_config, not carried by a real signed token
  for an agent user. This exercises the same policies but is weaker evidence
  than a run with a real agent credential.
- Only SELECT was tested. The agent's inability to update orders (no update
  policy for agent) was not tested here.
- The sub value is a made-up UUID, so the owner policies (orders_select_own)
  did not contribute to these counts.