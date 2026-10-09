-- =============================================================================
-- B2B wholesale: percentage tiers + one-time registration invite codes
-- Incremental migration for an EXISTING deployed database.
--
-- Safe to rerun: every statement is guarded (IF NOT EXISTS / OR REPLACE /
-- DROP POLICY IF EXISTS / conditional DO blocks). Run it inside the Supabase
-- SQL editor or via `psql < this file`. Runs in a single transaction.
--
-- Why this exists
--   1. Wholesale pricing was per-product FIXED prices (product_price_tiers.
--      unit_price). The shop now sells B2B on a PERCENTAGE ladder that applies
--      to every product at once:
--         Tier 1  5-10 units : 5%  off retail
--         Tier 2 11-30 units : 10% off retail
--         Tier 3   31+ units : 15% off retail (raisable to 20% per product)
--      Storing that as fixed prices would need ~3 rows per product (1000+);
--      price_list_percent_tiers stores it as THREE rows for the whole list,
--      with optional per-product override rows.
--   2. Wholesale signup previously had no self-service path at all. Admins now
--      issue a one-time code; the customer types it on the wholesale signup
--      form. The code is stored only as a SHA-256 hash, never in plain text.
--
-- Existing fixed-price lists are DEACTIVATED, not deleted, so this is
-- reversible: set is_active = true again to restore the old behaviour.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. percentage tiers
-- ---------------------------------------------------------------------------

-- product_id NULL  -> the band applies to EVERY product in the list.
-- product_id set   -> overrides the global band at the same min_quantity
--                     (this is how Tier 3 is raised from 15% to 20% for a
--                     chosen product).
create table if not exists public.price_list_percent_tiers (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references public.price_lists(id) on delete cascade,
  product_id integer references public.products(id) on delete cascade,
  min_quantity integer not null check (min_quantity > 0),
  discount_percent numeric(5, 2) not null
    check (discount_percent >= 0 and discount_percent <= 90),
  is_active boolean not null default true,
  effective_from timestamptz,
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    effective_from is null
    or effective_to is null
    or effective_to > effective_from
  )
);

-- Duplicate minimum quantities would make band selection ambiguous. Two
-- partial indexes instead of `unique nulls not distinct` so this also works on
-- Postgres 14 and older.
create unique index if not exists price_list_percent_tiers_global_uniq
  on public.price_list_percent_tiers (price_list_id, min_quantity)
  where product_id is null;

create unique index if not exists price_list_percent_tiers_product_uniq
  on public.price_list_percent_tiers (price_list_id, product_id, min_quantity)
  where product_id is not null;

create index if not exists price_list_percent_tiers_lookup_idx
  on public.price_list_percent_tiers (price_list_id, product_id);

-- ---------------------------------------------------------------------------
-- 2. one-time wholesale registration codes
-- ---------------------------------------------------------------------------

-- code_hash: SHA-256 of the plain code. The plain code is shown to the admin
-- exactly once, at creation, and is never recoverable from this table.
-- code_hint: last 4 characters only, so an admin can tell codes apart.
create table if not exists public.wholesale_invite_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  code_hint text not null,
  label text,
  price_list_id uuid references public.price_lists(id) on delete set null,
  max_uses integer not null default 1 check (max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists wholesale_invite_codes_active_idx
  on public.wholesale_invite_codes (is_active, expires_at);

-- Audit trail of which account redeemed which code (one row per account).
create table if not exists public.wholesale_registration_requests (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  invite_id uuid not null references public.wholesale_invite_codes(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Redeems a code and increments its counter in ONE atomic statement, so two
-- simultaneous signups can never both consume the last remaining use.
-- Returns the invite row on success, nothing when the code is unusable.
create or replace function public.redeem_wholesale_invite(p_code_hash text)
returns public.wholesale_invite_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.wholesale_invite_codes;
begin
  update public.wholesale_invite_codes
  set use_count = use_count + 1,
      last_used_at = now(),
      is_active = case when use_count + 1 >= max_uses then false else is_active end
  where code_hash = p_code_hash
    and is_active
    and use_count < max_uses
    and (expires_at is null or expires_at > now())
  returning * into v_invite;

  return v_invite;
end;
$$;

revoke execute on function public.redeem_wholesale_invite(text)
  from public, anon, authenticated;
grant execute on function public.redeem_wholesale_invite(text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. seed the B2B percentage ladder and move wholesale accounts onto it
-- ---------------------------------------------------------------------------

do $$
declare
  v_list uuid;
begin
  select id into v_list
  from public.price_lists
  where name = 'B2B Wholesale (% off retail)';

  if v_list is null then
    insert into public.price_lists (name, description, is_active)
    values (
      'B2B Wholesale (% off retail)',
      'Tier 1 (5-10 units): 5% off retail. Tier 2 (11-30 units): 10% off retail. Tier 3 (31+ units): 15% off retail, raisable to 20% for individual products.',
      true
    )
    returning id into v_list;
  end if;

  insert into public.price_list_percent_tiers
    (price_list_id, product_id, min_quantity, discount_percent)
  values
    (v_list, null, 5, 5),
    (v_list, null, 11, 10),
    (v_list, null, 31, 15)
  on conflict do nothing;

  -- Every approved wholesale account moves to the percentage ladder.
  update public.profiles
  set price_list_id = v_list
  where role = 'wholesale'
    and wholesale_status = 'approved';

  -- Invite codes created without an explicit list default to this one.
  update public.wholesale_invite_codes
  set price_list_id = v_list
  where price_list_id is null;

  -- Retire the fixed-price lists. Kept (not dropped) so re-activating them
  -- restores the previous pricing exactly.
  update public.price_lists
  set is_active = false
  where name in ('Sheet B2B (MMK)', 'Standard Wholesale');
end $$;

-- ---------------------------------------------------------------------------
-- 4. RLS + privilege hardening
-- ---------------------------------------------------------------------------

alter table public.price_list_percent_tiers enable row level security;
alter table public.wholesale_invite_codes enable row level security;
alter table public.wholesale_registration_requests enable row level security;

-- Percentage bands mirror product_price_tiers: admins manage, and an approved
-- wholesale customer may read only the bands of their own assigned list.
drop policy if exists "Admins manage percent tiers" on public.price_list_percent_tiers;
create policy "Admins manage percent tiers"
on public.price_list_percent_tiers for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Assigned wholesale users read own percent tiers" on public.price_list_percent_tiers;
create policy "Assigned wholesale users read own percent tiers"
on public.price_list_percent_tiers for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.wholesale_status = 'approved'
      and profiles.price_list_id = price_list_percent_tiers.price_list_id
  )
);

-- Invite codes are admin-only. Redemption happens server-side through the
-- service role, so customers never need (and never get) read access.
drop policy if exists "Admins manage invite codes" on public.wholesale_invite_codes;
create policy "Admins manage invite codes"
on public.wholesale_invite_codes for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins read invite redemptions" on public.wholesale_registration_requests;
create policy "Admins read invite redemptions"
on public.wholesale_registration_requests for select
to authenticated
using (public.is_admin());

revoke all on public.wholesale_invite_codes from anon, authenticated;
revoke all on public.wholesale_registration_requests from anon, authenticated;
grant select on public.wholesale_invite_codes to authenticated;
grant select on public.wholesale_registration_requests to authenticated;
grant select on public.price_list_percent_tiers to authenticated;

grant all on public.price_list_percent_tiers to service_role;
grant all on public.wholesale_invite_codes to service_role;
grant all on public.wholesale_registration_requests to service_role;

commit;
