-- Week 3 step H: conversation state with provenance.
-- The model API is stateless; the host stores every turn here and re-sends it.
-- Every message carries a provenance tag saying where it came from.
--   tool, system  -> verified   (the database's own answer; our own fixed text)
--   customer, model, human -> not verified (a claim, even a trusted human's)
-- "verified" is a GENERATED column: nobody can write it, so model text can never be stored as verified.
--
-- Who writes: a dedicated host identity, principal_type = 'agent_host' (no service key at runtime).
-- Who reads: the customer who owns the conversation, and staff reviewers.
-- History is append-only: update and delete are blocked by a trigger.

create type public.message_provenance as enum
  ('customer', 'tool', 'model', 'human', 'system');

create table public.conversations (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references auth.users (id) on delete restrict,
  created_at   timestamptz not null default now()
);

create index conversations_customer_id_idx on public.conversations (customer_id);

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete restrict,
  seq              bigint generated always as identity,
  provenance       public.message_provenance not null,
  verified         boolean generated always as
                     (provenance in ('tool', 'system')) stored,
  content          text not null check (length(btrim(content)) > 0),
  tool_name        text,
  tool_use_id      text,
  created_at       timestamptz not null default now(),
  -- a tool row names its tool; no other row may
  constraint messages_tool_name_matches_provenance
    check ((provenance = 'tool') = (tool_name is not null))
);

create index messages_conversation_seq_idx on public.messages (conversation_id, seq);

-- ---------------------------------------------------------------------------
-- Append-only history. A deliberate purge (for example an erasure request) must
-- set storefront.allow_history_purge = 'on' inside its own transaction.
-- ---------------------------------------------------------------------------
create function public.messages_are_append_only() returns trigger
language plpgsql as $$
begin
  if current_setting('storefront.allow_history_purge', true) = 'on'
     and tg_op = 'DELETE' then
    return old;
  end if;
  raise exception 'messages are append-only (% blocked)', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger messages_append_only
  before update or delete on public.messages
  for each row execute function public.messages_are_append_only();

-- ---------------------------------------------------------------------------
-- RLS: default deny, then additive policies.
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

revoke update, delete, truncate on public.conversations from anon, authenticated;
revoke update, delete, truncate on public.messages       from anon, authenticated;

create policy conversations_select_owner
  on public.conversations for select
  to authenticated
  using (customer_id = (select auth.uid()));

create policy conversations_select_staff
  on public.conversations for select
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'principal_type') = 'staff');

create policy conversations_insert_host
  on public.conversations for insert
  to authenticated
  with check ((select auth.jwt() -> 'app_metadata' ->> 'principal_type') = 'agent_host');

create policy messages_select_owner
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.customer_id = (select auth.uid())
    )
  );

create policy messages_select_staff
  on public.messages for select
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'principal_type') = 'staff');

create policy messages_insert_host
  on public.messages for insert
  to authenticated
  with check ((select auth.jwt() -> 'app_metadata' ->> 'principal_type') = 'agent_host');

-- The host also needs to read back what it wrote, to rebuild history on the next call.
create policy conversations_select_host
  on public.conversations for select
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'principal_type') = 'agent_host');

create policy messages_select_host
  on public.messages for select
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'principal_type') = 'agent_host');
