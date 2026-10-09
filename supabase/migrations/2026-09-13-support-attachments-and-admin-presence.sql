-- =============================================================================
-- Live chat: photo attachments, product context, and admin presence
-- Incremental migration for an EXISTING deployed database.
--
-- Safe to rerun: every statement is guarded (IF NOT EXISTS / OR REPLACE /
-- DROP POLICY IF EXISTS). Run it inside the Supabase SQL editor or via
-- `psql < this file`. Runs in a single transaction.
--
-- 1. support_messages gains an optional image attachment and an optional
--    product reference, so a customer can photograph a problem and the
--    administrator can see WHICH product the conversation is about.
--    Files live in the private `support-uploads` storage bucket; only the
--    object path is stored here and it is served through short-lived signed
--    URLs, never a public link.
-- 2. admin_presence is a single shared row describing whether the shop's
--    administrator is available, with a free-text note ("Back in 20 minutes")
--    and an optional return time the storefront can count down to.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. chat attachments + product context
-- ---------------------------------------------------------------------------

alter table public.support_messages
  add column if not exists attachment_path text;
alter table public.support_messages
  add column if not exists attachment_type text;
alter table public.support_messages
  add column if not exists product_id integer references public.products(id) on delete set null;

-- A message must carry something: text, a photo, or a product reference.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'support_messages_not_empty'
  ) then
    alter table public.support_messages
      add constraint support_messages_not_empty
      check (
        length(coalesce(body, '')) > 0
        or attachment_path is not null
        or product_id is not null
      );
  end if;
end $$;

create index if not exists support_messages_product_idx
  on public.support_messages (product_id)
  where product_id is not null;

-- ---------------------------------------------------------------------------
-- 2. administrator presence
-- ---------------------------------------------------------------------------

-- Exactly one row: `id` is a boolean pinned to true, so a second row is
-- impossible and every reader can use `where id = true`.
create table if not exists public.admin_presence (
  id boolean primary key default true check (id),
  status text not null default 'offline'
    check (status in ('online', 'away', 'busy', 'offline')),
  message text,
  back_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.admin_presence (id, status, message)
values (true, 'offline', null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. RLS + privileges
-- ---------------------------------------------------------------------------

alter table public.admin_presence enable row level security;

-- Presence is deliberately readable by everyone, including signed-out
-- visitors: the storefront shows "Admin is online / back in 20 minutes"
-- before a customer decides to start a conversation.
drop policy if exists "Anyone may read admin presence" on public.admin_presence;
create policy "Anyone may read admin presence"
on public.admin_presence for select
to anon, authenticated
using (true);

drop policy if exists "Admins update presence" on public.admin_presence;
create policy "Admins update presence"
on public.admin_presence for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.admin_presence to anon, authenticated;
grant all on public.admin_presence to service_role;

-- Customers may write the new message columns only through the server (the
-- support routes run with the service role after authenticating the sender);
-- direct PostgREST writes stay closed exactly as before this migration.

commit;
