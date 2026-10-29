-- Re-dates seed order 103 to 2 days before now, so the 30-day refund window
-- facts in the golden sets stay true (RF-01, RT-11, RT-16).
--
-- Its payment events move by the same amount, so a payment never appears to
-- be captured before the order existed.
--
-- Safe to re-run: each run re-dates order 103 to 2 days before the moment
-- it runs. Run it in the Supabase SQL Editor before a golden run whenever
-- order 103 is more than about 25 days old.
--
-- Only order 103 matters. 101 and 104 are already refunded or outside the
-- window, 102 is far outside it, and 105 to 108 are pending (never refundable).

with target as (
  select id, (now() - interval '2 days') - created_at as shift
  from orders
  where id = '5eed0000-0000-4000-8000-000000000103'
),
moved_events as (
  update payment_events pe
  set received_at = pe.received_at + t.shift
  from target t
  where pe.order_id = t.id
  returning pe.id
)
update orders o
set created_at = o.created_at + t.shift,
    updated_at = o.updated_at + t.shift
from target t
where o.id = t.id;
