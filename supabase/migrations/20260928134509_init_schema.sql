-- Initial storefront schema: products, carts, cart_items, orders, payment_events.
-- Money is stored as integer minor units (e.g. cents) alongside an ISO 4217 currency code.
-- Roles: staff/agent are identified ONLY via auth.jwt() -> 'app_metadata' ->> 'principal_type'
-- (app_metadata is server-controlled; user_metadata is user-editable and must never be trusted).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  sku          text not null unique,
  name         text not null,
  description  text,
  price_minor  bigint not null check (price_minor >= 0),
  currency     char(3) not null check (currency ~ '^[A-Z]{3}$'),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.carts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index carts_user_id_idx on public.carts (user_id);

create table public.cart_items (
  id          uuid primary key default gen_random_uuid(),
  cart_id     uuid not null references public.carts (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete restrict,
  quantity    integer not null check (quantity > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (cart_id, product_id)
);

create index cart_items_product_id_idx on public.cart_items (product_id);

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete restrict,
  status          text not null default 'pending'
                  check (status in ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded')),
  currency        char(3) not null check (currency ~ '^[A-Z]{3}$'),
  subtotal_minor  bigint not null check (subtotal_minor >= 0),
  total_minor     bigint not null check (total_minor >= 0),
  psp_reference   text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index orders_user_id_idx on public.orders (user_id);

create table public.payment_events (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid references public.orders (id) on delete restrict,
  psp_reference  text not null,
  event_type     text not null,
  amount_minor   bigint check (amount_minor >= 0),
  currency       char(3) check (currency ~ '^[A-Z]{3}$'),
  payload        jsonb not null,
  received_at    timestamptz not null default now(),
  unique (psp_reference, event_type)
);

create index payment_events_order_id_idx on public.payment_events (order_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.products       enable row level security;
alter table public.carts          enable row level security;
alter table public.cart_items     enable row level security;
alter table public.orders         enable row level security;
alter table public.payment_events enable row level security;

-- ---------------------------------------------------------------------------
-- Grants (auto-expose is off, so nothing is reachable via the API without these)
-- ---------------------------------------------------------------------------

revoke all on public.products, public.carts, public.cart_items, public.orders, public.payment_events
  from anon, authenticated;

grant select on public.products to anon, authenticated;

grant select, insert, update, delete on public.carts      to authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;

-- Customers never insert orders directly; checkout runs server-side as service_role.
grant select on public.orders to authenticated;
-- Column-level: the only column any authenticated role may update is status.
grant update (status) on public.orders to authenticated;

grant select on public.payment_events to authenticated;

-- service_role bypasses RLS but still needs table privileges when auto-expose is off.
grant all on public.products, public.carts, public.cart_items, public.orders, public.payment_events
  to service_role;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- products: anyone can read active products.
create policy products_select_active
  on public.products for select
  to anon, authenticated
  using (active);

-- carts: owner-only.
create policy carts_owner_all
  on public.carts for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- cart_items: owner-only via parent cart.
create policy cart_items_owner_all
  on public.cart_items for all
  to authenticated
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id
        and c.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id
        and c.user_id = (select auth.uid())
    )
  );

-- orders: customer reads own.
create policy orders_select_own
  on public.orders for select
  to authenticated
  using (user_id = (select auth.uid()));

-- orders: staff and agent read all.
create policy orders_select_staff_agent
  on public.orders for select
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'principal_type') in ('staff', 'agent'));

-- orders: staff update status on any order (agent is read-only, so no update policy for agent).
-- The column-level grant above already limits updates to status, so the policy only
-- needs to decide who may update: the same staff predicate in using and with check.
create policy orders_update_staff
  on public.orders for update
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'principal_type') = 'staff')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'principal_type') = 'staff');

-- payment_events: staff read only.
create policy payment_events_select_staff
  on public.payment_events for select
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'principal_type') = 'staff');
