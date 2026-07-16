-- =============================================================================
-- Wholesale accounts + quantity-tier pricing + numeric inventory
-- Incremental migration for an EXISTING deployed database.
--
-- Safe to rerun: every statement is guarded (IF NOT EXISTS / OR REPLACE /
-- DROP POLICY IF EXISTS / conditional DO blocks). Run it inside the Supabase
-- SQL editor or via `psql < this file`. Runs in a single transaction.
--
-- Wholesale accounts are provisioned by an ADMINISTRATOR only (there is no
-- self-service application flow): the customer registers a normal account,
-- an admin grants wholesale access in the dashboard, and the customer logs
-- in like any other user -- tier prices then apply automatically.
--
-- Order of operations (already arranged below):
--   1. profiles: wholesale_status + price_list_id columns
--   2. price_lists, product_price_tiers
--   3. audit_log
--   4. products.stock_quantity (numeric inventory) + stock-text sync trigger
--   5. order_items pricing snapshot columns
--   6. One-time backfills (standard wholesale price list from
--      products.wholesale_price; stock_quantity from the stock text)
--   7. checkout_order() atomic checkout function
--   8. RLS policies + privilege hardening
--
-- One-time backfill notes:
--   * Every product with a non-null wholesale_price gets a single tier in the
--     "Standard Wholesale" price list with MIN_QUANTITY = 1 (documented
--     default: previously the wholesale price applied from quantity 1).
--   * Existing 'wholesale' profiles are marked approved and assigned to the
--     standard list so current wholesale customers keep their pricing.
--   * stock backfill: 'In Stock' -> stock_quantity = 100 (documented default,
--     adjust per product in the admin panel), 'Out of Stock' -> 0.
--   * After this migration, products.wholesale_price is LEGACY ONLY: pricing
--     reads tiers exclusively. The column is kept so the Google Sheets sync
--     keeps working unchanged, but it is no longer served to storefront users.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. profiles: wholesale status + assigned price list
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists wholesale_status text not null default 'not_applied';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_wholesale_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_wholesale_status_check
      check (wholesale_status in ('not_applied', 'approved', 'suspended'));
  end if;
end $$;

-- Public signup must never be able to choose a privileged role. The old
-- trigger honored raw_user_meta_data->>'role' = 'wholesale', which anyone
-- could send straight to GoTrue's public /signup endpoint. Every new account
-- is now 'normal'; wholesale access is only granted through admin approval.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    'normal'
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. price lists + product quantity tiers
-- ---------------------------------------------------------------------------

create table if not exists public.price_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists price_list_id uuid references public.price_lists(id) on delete set null;

create table if not exists public.product_price_tiers (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references public.price_lists(id) on delete cascade,
  product_id integer not null references public.products(id) on delete cascade,
  min_quantity integer not null check (min_quantity > 0),
  unit_price integer not null check (unit_price >= 0),
  is_active boolean not null default true,
  effective_from timestamptz,
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Duplicate minimum quantities for the same product+list are meaningless
  -- (tier selection would be ambiguous), so they are rejected outright.
  unique (price_list_id, product_id, min_quantity),
  check (
    effective_from is null
    or effective_to is null
    or effective_to > effective_from
  )
);

create index if not exists product_price_tiers_product_idx
  on public.product_price_tiers (product_id, price_list_id);

create index if not exists profiles_price_list_idx
  on public.profiles (price_list_id);

-- ---------------------------------------------------------------------------
-- 3. audit log
-- ---------------------------------------------------------------------------

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  previous_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_target_idx
  on public.audit_log (target_type, target_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. numeric inventory
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists stock_quantity integer not null default 0
  check (stock_quantity >= 0);

-- stock_quantity is authoritative for checkout. The legacy "stock" text stays
-- for display/sheet-sync compatibility and is kept consistent by trigger:
--   * if the numeric quantity changed, the text is derived from it;
--   * else if only the text changed to 'Out of Stock', quantity goes to 0;
--   * else if only the text changed to 'In Stock' while quantity is 0, the
--     quantity becomes 100 (the same documented default as the backfill).
create or replace function public.sync_product_stock()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.stock_quantity is distinct from 0 then
      new.stock = case when new.stock_quantity > 0 then 'In Stock' else 'Out of Stock' end;
    elsif new.stock = 'In Stock' then
      new.stock_quantity = 100;
    else
      new.stock_quantity = 0;
    end if;
    return new;
  end if;

  if new.stock_quantity is distinct from old.stock_quantity then
    new.stock = case when new.stock_quantity > 0 then 'In Stock' else 'Out of Stock' end;
  elsif new.stock is distinct from old.stock then
    if new.stock = 'Out of Stock' then
      new.stock_quantity = 0;
    elsif new.stock_quantity = 0 then
      new.stock_quantity = 100;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_products_stock on public.products;
create trigger sync_products_stock
before insert or update on public.products
for each row execute function public.sync_product_stock();

-- ---------------------------------------------------------------------------
-- 5. order_items pricing snapshot
-- ---------------------------------------------------------------------------

alter table public.order_items
  add column if not exists retail_unit_price integer check (retail_unit_price >= 0);
alter table public.order_items
  add column if not exists price_list_id uuid references public.price_lists(id) on delete set null;
alter table public.order_items
  add column if not exists tier_id uuid references public.product_price_tiers(id) on delete set null;
alter table public.order_items
  add column if not exists tier_min_quantity integer check (tier_min_quantity > 0);

-- ---------------------------------------------------------------------------
-- 6. one-time backfills (idempotent)
-- ---------------------------------------------------------------------------

-- 6a. Standard wholesale price list + tiers from legacy wholesale_price.
do $$
declare
  v_list_id uuid;
begin
  select id into v_list_id from public.price_lists where name = 'Standard Wholesale';

  if v_list_id is null then
    insert into public.price_lists (name, description, is_active)
    values (
      'Standard Wholesale',
      'Migrated from the legacy products.wholesale_price column. Tiers apply from quantity 1 (the legacy behavior); adjust minimum quantities per product as needed.',
      true
    )
    returning id into v_list_id;
  end if;

  insert into public.product_price_tiers
    (price_list_id, product_id, min_quantity, unit_price, is_active)
  select v_list_id, p.id, 1, p.wholesale_price, true
  from public.products p
  where p.wholesale_price is not null
  on conflict (price_list_id, product_id, min_quantity) do nothing;

  -- Existing wholesale accounts keep working: approved + standard list.
  update public.profiles
  set wholesale_status = 'approved',
      price_list_id = coalesce(price_list_id, v_list_id)
  where role = 'wholesale'
    and wholesale_status = 'not_applied';
end $$;

-- 6b. Numeric stock from the legacy text (only rows never touched before:
-- quantity still at the 0 default while the text says In Stock).
update public.products
set stock_quantity = 100
where stock = 'In Stock' and stock_quantity = 0;

-- ---------------------------------------------------------------------------
-- 7. atomic checkout
-- ---------------------------------------------------------------------------

-- Creates the order, inserts every order item with its pricing snapshot,
-- decrements inventory, and clears the cart in ONE transaction. Product rows
-- are locked FOR UPDATE so concurrent checkouts cannot oversell.
--
-- SECURITY: execute is granted ONLY to service_role. The Next.js route
-- handler authenticates the caller (Supabase access token), recomputes every
-- price server-side from tiers, and passes the result here. Browsers can
-- never reach this function through PostgREST (anon/authenticated have no
-- execute privilege), so neither p_user_id nor the line prices can be forged
-- by a client. As defense in depth the function additionally verifies that
-- the submitted lines exactly match the user's current cart rows.
--
-- p_lines: jsonb array of
--   { product_id int, quantity int, unit_price int, retail_unit_price int,
--     price_list_id uuid|null, tier_id uuid|null, tier_min_quantity int|null }
create or replace function public.checkout_order(
  p_user_id uuid,
  p_shipping_name text,
  p_shipping_phone text,
  p_shipping_address text,
  p_notes text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total bigint := 0;
  v_line record;
  v_product record;
  v_cart_quantity integer;
  v_cart_count integer;
  v_line_count integer;
begin
  if p_user_id is null then
    raise exception 'checkout_order: user id is required' using errcode = 'P0001';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'CART_EMPTY' using errcode = 'P0001';
  end if;

  -- The submitted lines must exactly mirror the user's current cart.
  select count(*) into v_cart_count
  from public.cart_items where user_id = p_user_id;

  select count(*) into v_line_count
  from jsonb_array_elements(p_lines);

  if v_cart_count <> v_line_count then
    raise exception 'CART_CHANGED' using errcode = 'P0001';
  end if;

  for v_line in
    select
      (value ->> 'product_id')::integer as product_id,
      (value ->> 'quantity')::integer as quantity,
      (value ->> 'unit_price')::integer as unit_price,
      (value ->> 'retail_unit_price')::integer as retail_unit_price,
      nullif(value ->> 'price_list_id', '')::uuid as price_list_id,
      nullif(value ->> 'tier_id', '')::uuid as tier_id,
      nullif(value ->> 'tier_min_quantity', '')::integer as tier_min_quantity
    from jsonb_array_elements(p_lines)
  loop
    if v_line.quantity is null or v_line.quantity <= 0
      or v_line.unit_price is null or v_line.unit_price < 0 then
      raise exception 'INVALID_LINE' using errcode = 'P0001';
    end if;

    select quantity into v_cart_quantity
    from public.cart_items
    where user_id = p_user_id and product_id = v_line.product_id;

    if v_cart_quantity is null or v_cart_quantity <> v_line.quantity then
      raise exception 'CART_CHANGED' using errcode = 'P0001';
    end if;

    v_total := v_total + (v_line.unit_price::bigint * v_line.quantity);
  end loop;

  insert into public.orders
    (user_id, status, total_amount, shipping_name, shipping_phone, shipping_address, notes)
  values
    (p_user_id, 'pending', v_total, p_shipping_name, p_shipping_phone, p_shipping_address, p_notes)
  returning id into v_order_id;

  for v_line in
    select
      (value ->> 'product_id')::integer as product_id,
      (value ->> 'quantity')::integer as quantity,
      (value ->> 'unit_price')::integer as unit_price,
      (value ->> 'retail_unit_price')::integer as retail_unit_price,
      nullif(value ->> 'price_list_id', '')::uuid as price_list_id,
      nullif(value ->> 'tier_id', '')::uuid as tier_id,
      nullif(value ->> 'tier_min_quantity', '')::integer as tier_min_quantity
    from jsonb_array_elements(p_lines)
  loop
    -- Lock the product row: concurrent checkouts for the same product
    -- serialize here, so the quantity check below cannot race.
    select id, stock_quantity into v_product
    from public.products
    where id = v_line.product_id
    for update;

    if v_product.id is null then
      raise exception 'PRODUCT_NOT_FOUND:%', v_line.product_id using errcode = 'P0001';
    end if;

    if v_product.stock_quantity < v_line.quantity then
      raise exception 'INSUFFICIENT_STOCK:%:%', v_line.product_id, v_product.stock_quantity
        using errcode = 'P0001';
    end if;

    update public.products
    set stock_quantity = stock_quantity - v_line.quantity
    where id = v_line.product_id;

    insert into public.order_items
      (order_id, product_id, quantity, unit_price,
       retail_unit_price, price_list_id, tier_id, tier_min_quantity)
    values
      (v_order_id, v_line.product_id, v_line.quantity, v_line.unit_price,
       v_line.retail_unit_price, v_line.price_list_id, v_line.tier_id, v_line.tier_min_quantity);
  end loop;

  delete from public.cart_items where user_id = p_user_id;

  return jsonb_build_object('order_id', v_order_id, 'total_amount', v_total);
end;
$$;

revoke execute on function public.checkout_order(uuid, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.checkout_order(uuid, text, text, text, text, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- 8. RLS + privilege hardening
-- ---------------------------------------------------------------------------

-- Older deployments may not have the admin-policy helper from the current
-- base schema. Create it here before any of the policies below reference it.
-- SECURITY DEFINER avoids recursive profiles RLS checks while still limiting
-- the result to whether the current authenticated user has the admin role.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.price_lists enable row level security;
alter table public.product_price_tiers enable row level security;
alter table public.audit_log enable row level security;

-- Databases deployed before the current base schema lack this policy, which
-- leaves admin-token profile reads (customer counts, customer lists) empty.
drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles"
on public.profiles for select
to authenticated
using (public.is_admin());

-- Confidential price data: admins see everything; an approved wholesale
-- customer sees only their own assigned price list and its tiers. Anonymous
-- and ordinary customers see nothing.
drop policy if exists "Admins manage price lists" on public.price_lists;
create policy "Admins manage price lists"
on public.price_lists for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Assigned wholesale users read own price list" on public.price_lists;
create policy "Assigned wholesale users read own price list"
on public.price_lists for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.wholesale_status = 'approved'
      and profiles.price_list_id = price_lists.id
  )
);

drop policy if exists "Admins manage price tiers" on public.product_price_tiers;
create policy "Admins manage price tiers"
on public.product_price_tiers for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Assigned wholesale users read own tiers" on public.product_price_tiers;
create policy "Assigned wholesale users read own tiers"
on public.product_price_tiers for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.wholesale_status = 'approved'
      and profiles.price_list_id = product_price_tiers.price_list_id
  )
);

-- Audit log: admins read; nothing else. Writes go through the service role
-- only (no INSERT policy, no INSERT grant for authenticated).
drop policy if exists "Admins read audit log" on public.audit_log;
create policy "Admins read audit log"
on public.audit_log for select
to authenticated
using (public.is_admin());

revoke insert, update, delete on public.audit_log from anon, authenticated;

-- Wholesale access itself is granted/revoked exclusively by administrators
-- through the admin API (service role after requireAdmin()); there is no
-- customer-facing application table or flow.

-- profiles hardening: Supabase's default grants allow UPDATE on every
-- column, and the "Users update own profile" policy only pins the row, so a
-- customer could previously PATCH their own role/wholesale_status through
-- PostgREST. Column-level grants close that: profile self-service is limited
-- to full_name and phone. role / wholesale_status / price_list_id are only
-- ever changed server-side with the service role (admin routes) or by the
-- handle_new_user trigger.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- Orders are created exclusively by checkout_order() now. The old policies
-- let a client insert orders/order_items with arbitrary prices through
-- PostgREST -- remove them.
drop policy if exists "Users create own orders" on public.orders;
drop policy if exists "Users create own order items" on public.order_items;
revoke insert on public.orders from anon, authenticated;
revoke insert on public.order_items from anon, authenticated;

-- Inventory: only admins may change products (existing policies); customers
-- never write stock_quantity directly (checkout_order runs as definer).

grant select on public.price_lists to authenticated;
grant select on public.product_price_tiers to authenticated;
grant select on public.audit_log to authenticated;
grant all on public.price_lists to service_role;
grant all on public.product_price_tiers to service_role;
grant all on public.audit_log to service_role;

-- If an earlier version of this migration created the (now removed)
-- customer application table, drop it -- applications were merged into
-- direct admin provisioning and the table was never used by this code.
drop table if exists public.wholesale_applications;
grant execute on function public.is_admin() to authenticated;

commit;
