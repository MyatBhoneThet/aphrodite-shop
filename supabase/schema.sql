create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'normal' check (role in ('normal', 'wholesale', 'admin')),
  -- Wholesale access is granted/revoked by administrators only (no
  -- customer application flow): not_applied -> approved <-> suspended.
  wholesale_status text not null default 'not_applied'
    check (wholesale_status in ('not_applied', 'approved', 'suspended')),
  -- price_list_id is added after price_lists exists (see below).
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id serial primary key,
  name text not null,
  type text not null check (type in ('laptop', 'accessory')),
  category text not null,
  brand text not null,
  price integer not null check (price >= 0),
  wholesale_price integer check (wholesale_price >= 0),
  image text not null,
  model_3d text,
  stock text not null check (stock in ('In Stock', 'Out of Stock')),
  -- Authoritative inventory for checkout; the "stock" text above is a legacy
  -- display value kept in sync by the sync_products_stock trigger.
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  specs jsonb not null default '{}'::jsonb,
  full_specs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id integer not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id integer not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (
    status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')
  ),
  total_amount integer not null check (total_amount >= 0),
  shipping_name text not null,
  shipping_phone text not null,
  shipping_address text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id integer not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price integer not null check (unit_price >= 0),
  -- Pricing snapshot: what the customer actually paid and which price
  -- list/tier produced it. Historical orders stay stable when tiers change.
  retail_unit_price integer check (retail_unit_price >= 0),
  price_list_id uuid,
  tier_id uuid,
  tier_min_quantity integer check (tier_min_quantity > 0)
);

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

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'order_items_price_list_id_fkey'
  ) then
    alter table public.order_items
      add constraint order_items_price_list_id_fkey
      foreign key (price_list_id) references public.price_lists(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'order_items_tier_id_fkey'
  ) then
    alter table public.order_items
      add constraint order_items_tier_id_fkey
      foreign key (tier_id) references public.product_price_tiers(id) on delete set null;
  end if;
end $$;

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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists set_cart_items_updated_at on public.cart_items;
create trigger set_cart_items_updated_at
before update on public.cart_items
for each row execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists set_price_lists_updated_at on public.price_lists;
create trigger set_price_lists_updated_at
before update on public.price_lists
for each row execute function public.set_updated_at();

drop trigger if exists set_product_price_tiers_updated_at on public.product_price_tiers;
create trigger set_product_price_tiers_updated_at
before update on public.product_price_tiers
for each row execute function public.set_updated_at();

-- stock_quantity is authoritative for checkout. The legacy "stock" text is
-- kept consistent with it:
--   * numeric quantity changed -> text derived from it;
--   * only the text changed to 'Out of Stock' -> quantity 0;
--   * only the text changed to 'In Stock' while quantity is 0 -> quantity 100
--     (documented default, same as the migration backfill).
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Always 'normal': signup metadata is client-controlled and must never be
  -- able to grant wholesale/admin privileges. Wholesale access is granted
  -- only through the admin approval flow.
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.price_lists enable row level security;
alter table public.product_price_tiers enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
on public.profiles for select
using (id = auth.uid());

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- A profiles policy cannot subquery public.profiles directly (self-reference
-- triggers "infinite recursion detected in policy for relation"). This
-- security definer function runs as the function owner, which bypasses RLS
-- on its internal lookup (tables here only use ENABLE, not FORCE, row level
-- security), so it can safely answer "is the current user an admin?" without
-- recursing back into this table's own policies.
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

drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles"
on public.profiles for select
to authenticated
using (public.is_admin());

drop policy if exists "Public product reads" on public.products;
create policy "Public product reads"
on public.products for select
using (true);

drop policy if exists "Admins insert products" on public.products;
create policy "Admins insert products"
on public.products for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins update products" on public.products;
create policy "Admins update products"
on public.products for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins delete products" on public.products;
create policy "Admins delete products"
on public.products for delete
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Users manage own cart" on public.cart_items;
create policy "Users manage own cart"
on public.cart_items for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users manage own wishlist" on public.wishlist_items;
create policy "Users manage own wishlist"
on public.wishlist_items for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Owners or admins read orders" on public.orders;
create policy "Owners or admins read orders"
on public.orders for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

-- Orders are created exclusively by the checkout_order() function (below),
-- which runs as its definer. Clients have no INSERT policy on orders or
-- order_items: a direct PostgREST insert could otherwise carry an arbitrary
-- unit_price/total_amount.
drop policy if exists "Users create own orders" on public.orders;

drop policy if exists "Admins update orders" on public.orders;
create policy "Admins update orders"
on public.orders for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Owners or admins read order items" on public.order_items;
create policy "Owners or admins read order items"
on public.order_items for select
to authenticated
using (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and (
        orders.user_id = auth.uid()
        or exists (
          select 1 from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
  )
);

drop policy if exists "Users create own order items" on public.order_items;

-- Confidential price data: admins manage everything; an approved wholesale
-- customer reads only their own assigned price list and its tiers. Anonymous
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

-- Wholesale access itself is granted/revoked exclusively by administrators
-- through the admin API (service role after requireAdmin()); there is no
-- customer-facing application table or flow.

-- Audit log: admins read; writes only through the service role.
drop policy if exists "Admins read audit log" on public.audit_log;
create policy "Admins read audit log"
on public.audit_log for select
to authenticated
using (public.is_admin());

-- Creates the order, inserts every order item with its pricing snapshot,
-- decrements inventory, and clears the cart in ONE transaction. Product rows
-- are locked FOR UPDATE so concurrent checkouts cannot oversell.
--
-- SECURITY: execute is granted ONLY to service_role. The Next.js route
-- handler authenticates the caller, recomputes every price server-side from
-- tiers, and passes the result here; PostgREST clients (anon/authenticated)
-- cannot reach this function, so neither p_user_id nor the line prices can
-- be forged by a browser. As defense in depth the function verifies that the
-- submitted lines exactly match the user's current cart rows.
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
      (value ->> 'unit_price')::integer as unit_price
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

grant usage on schema public to anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant select on public.products to anon, authenticated;
grant select on public.profiles to authenticated;
-- Profile self-service is limited to these columns; role, wholesale_status
-- and price_list_id change only server-side (service role / admin routes).
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
revoke insert on public.orders from anon, authenticated;
revoke insert on public.order_items from anon, authenticated;
grant select on public.price_lists to authenticated;
grant select on public.product_price_tiers to authenticated;
grant select on public.audit_log to authenticated;
revoke insert, update, delete on public.audit_log from anon, authenticated;
grant all on public.profiles to service_role;
grant all on public.products to service_role;
grant all on public.cart_items to service_role;
grant all on public.wishlist_items to service_role;
grant all on public.orders to service_role;
grant all on public.order_items to service_role;
grant all on public.price_lists to service_role;
grant all on public.product_price_tiers to service_role;
grant all on public.audit_log to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

insert into public.products (
  id,
  name,
  type,
  category,
  brand,
  price,
  wholesale_price,
  image,
  model_3d,
  stock,
  specs,
  full_specs
)
values
  (
    1,
    'MacBook Air M2',
    'laptop',
    'Laptop',
    'Apple',
    36900,
    33500,
    '/products/macbook-air.png',
    '/models/macbook-air.glb',
    'In Stock',
    '{"cpu":"Apple M2","ram":"8GB","storage":"256GB SSD","display":"13.6 inch"}',
    '{"processor":"Apple M2 chip","ram":"8GB Unified Memory","storage":"256GB SSD","graphics":"Apple 8-core GPU","display":"13.6-inch Liquid Retina Display","battery":"Up to 18 hours","weight":"1.24 kg","ports":"2x Thunderbolt / USB 4, MagSafe 3, headphone jack","operatingSystem":"macOS","warranty":"1 year","condition":"New","color":"Midnight"}'
  ),
  (
    2,
    'MacBook Pro M3',
    'laptop',
    'Laptop',
    'Apple',
    56900,
    52000,
    '/products/macbook-pro.jpg',
    '/models/macbook-pro.glb',
    'In Stock',
    '{"cpu":"Apple M3","ram":"8GB","storage":"512GB SSD","display":"14 inch"}',
    '{"processor":"Apple M3 chip","ram":"8GB Unified Memory","storage":"512GB SSD","graphics":"Apple 10-core GPU","display":"14-inch Liquid Retina XDR Display","battery":"Up to 22 hours","weight":"1.55 kg","ports":"Thunderbolt / USB 4, HDMI, SDXC, MagSafe 3, headphone jack","operatingSystem":"macOS","warranty":"1 year","condition":"New","color":"Space Black"}'
  ),
  (
    3,
    'Gaming Laptop RTX',
    'laptop',
    'Gaming Laptop',
    'Acer',
    42900,
    39000,
    '/products/gaming-laptop.png',
    '/models/gaming-laptop.glb',
    'Out of Stock',
    '{"cpu":"Intel Core i7","ram":"16GB","storage":"1TB SSD","display":"15.6 inch"}',
    '{"processor":"Intel Core i7","ram":"16GB DDR5","storage":"1TB SSD","graphics":"NVIDIA GeForce RTX","display":"15.6-inch FHD 144Hz Display","battery":"Up to 6 hours","weight":"2.2 kg","ports":"USB-C, USB-A, HDMI, LAN, headphone jack","operatingSystem":"Windows 11","warranty":"1 year","condition":"New","color":"Black"}'
  ),
  (
    4,
    'Wireless Mouse',
    'accessory',
    'Accessories',
    'Logitech',
    890,
    720,
    '/products/mouse.png',
    null,
    'In Stock',
    '{"detail":"Wireless mouse for laptop and office use"}',
    '{"detail":"Wireless mouse for office, study and laptop setup","color":"Black","warranty":"1 year","condition":"New"}'
  ),
  (
    5,
    'Mechanical Keyboard',
    'accessory',
    'Accessories',
    'Keychron',
    2890,
    2500,
    '/products/keyboard.png',
    null,
    'In Stock',
    '{"detail":"Compact keyboard for laptop setup"}',
    '{"detail":"Compact mechanical keyboard for laptop setup","color":"Black / Grey","warranty":"1 year","condition":"New"}'
  ),
  (
    6,
    'Laptop Bag',
    'accessory',
    'Accessories',
    'Aphrodite',
    1290,
    990,
    '/products/laptop-bag.png',
    null,
    'Out of Stock',
    '{"detail":"Water-resistant laptop bag"}',
    '{"detail":"Water-resistant laptop bag for 13-inch to 15-inch laptops","color":"Black","warranty":"No warranty","condition":"New"}'
  )
on conflict (id) do update set
  name = excluded.name,
  type = excluded.type,
  category = excluded.category,
  brand = excluded.brand,
  price = excluded.price,
  wholesale_price = excluded.wholesale_price,
  image = excluded.image,
  model_3d = excluded.model_3d,
  stock = excluded.stock,
  specs = excluded.specs,
  full_specs = excluded.full_specs,
  updated_at = now();

select setval(
  pg_get_serial_sequence('public.products', 'id'),
  greatest((select max(id) from public.products), 1),
  true
);

-- Standard wholesale price list seeded from the legacy wholesale_price
-- values (min quantity 1 mirrors the legacy "always applies" behavior).
-- products.wholesale_price is LEGACY after this: pricing reads tiers only.
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

  update public.profiles
  set wholesale_status = 'approved',
      price_list_id = coalesce(price_list_id, v_list_id)
  where role = 'wholesale'
    and wholesale_status = 'not_applied';
end $$;

-- Numeric stock backfill for rows that predate stock_quantity (documented
-- default: 'In Stock' -> 100, adjust per product in the admin panel).
update public.products
set stock_quantity = 100
where stock = 'In Stock' and stock_quantity = 0;
