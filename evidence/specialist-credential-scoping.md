# Specialist credential scoping: simulated claims (2026-10-04)

Migration: supabase/migrations/20261004150711_specialist_agent_policies.sql
Principals (Auth users, claim app_metadata.principal_type):
agent_order_status, agent_refund, agent_decline.

## Query (run in the Supabase SQL editor, once per principal)

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"principal_type":"<principal>"}}',
  true);
select
  (select count(*) from public.orders) as orders_visible,
  (select count(*) from public.payment_events) as payment_events_visible;
rollback;
```

## Results

| principal_type | orders_visible | payment_events_visible |
|---|---|---|
| agent_order_status | 13 | 0 |
| agent_refund | 13 | 20 |
| agent_decline | 0 | 20 |

## Known limits

- Claims were simulated with set_config, not carried by a real sign-in. The
  step F evidence (a real credential denied another specialist's data) is
  still to do.
- A denied read returns zero rows, not a permission error, because all
  specialists connect as the Postgres role `authenticated`.
- These principals can read all customers' orders. They are not scoped to
  the customer in the current session.