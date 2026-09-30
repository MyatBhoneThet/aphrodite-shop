-- Customer account settings, default delivery details, preferences, and
-- account-based recently viewed products.
-- Apply after 2026-07-28-live-support-chat.sql.

alter table public.profiles
  add column if not exists shipping_address_line1 text,
  add column if not exists shipping_address_line2 text,
  add column if not exists shipping_city text,
  add column if not exists shipping_state text,
  add column if not exists shipping_postal_code text,
  add column if not exists shipping_country text not null default 'Thailand',
  add column if not exists preferred_language text not null default 'en',
  add column if not exists order_updates_enabled boolean not null default true,
  add column if not exists support_updates_enabled boolean not null default true,
  add column if not exists marketing_emails_enabled boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_preferred_language_check;
alter table public.profiles
  add constraint profiles_preferred_language_check
  check (preferred_language in ('en', 'my'));

create table if not exists public.recently_viewed_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  product_id integer not null
    references public.products(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists recently_viewed_user_time_idx
  on public.recently_viewed_products (user_id, viewed_at desc);

alter table public.recently_viewed_products enable row level security;

-- Settings and history are changed only by authenticated server routes using
-- the service role after checking the customer identity. Browser roles cannot
-- query another customer's history or change protected profile columns.
revoke all on table public.recently_viewed_products
  from public, anon, authenticated;
grant select, insert, update, delete on table public.recently_viewed_products
  to service_role;

notify pgrst, 'reload schema';
