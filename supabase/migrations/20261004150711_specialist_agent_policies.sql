   -- Specialist agent principals: read-only, scoped to the tables each needs.
   -- order status:        orders
   -- refund eligibility:  orders, payment_events
   -- decline explainer:   payment_events
   -- Policies are additive; existing staff and agent policies are unchanged.

   create policy orders_select_specialists
     on public.orders for select
     to authenticated
     using (
       (select auth.jwt() -> 'app_metadata' ->> 'principal_type')
         in ('agent_order_status', 'agent_refund')
     );

   create policy payment_events_select_specialists
     on public.payment_events for select
     to authenticated
     using (
       (select auth.jwt() -> 'app_metadata' ->> 'principal_type')
         in ('agent_refund', 'agent_decline')
     );