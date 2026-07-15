create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'normal' check (role in ('normal', 'wholesale', 'admin')),
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
  unit_price integer not null check (unit_price >= 0)
);

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
    case
      when new.raw_user_meta_data ->> 'role' = 'wholesale' then 'wholesale'
      else 'normal'
    end
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

drop policy if exists "Users create own orders" on public.orders;
create policy "Users create own orders"
on public.orders for insert
to authenticated
with check (user_id = auth.uid());

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
create policy "Users create own order items"
on public.order_items for insert
to authenticated
with check (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
);

grant usage on schema public to anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant select on public.products to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant all on public.products to service_role;
grant all on public.cart_items to service_role;
grant all on public.wishlist_items to service_role;
grant all on public.orders to service_role;
grant all on public.order_items to service_role;
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
