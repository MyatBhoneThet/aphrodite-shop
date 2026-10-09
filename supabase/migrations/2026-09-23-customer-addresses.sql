create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 40),
  recipient_name text not null,
  phone text not null,
  address_line1 text not null,
  address_line2 text,
  township text not null,
  postal_code text,
  latitude double precision not null check (latitude between 15.65 and 17.85),
  longitude double precision not null check (longitude between 95.65 and 96.95),
  accuracy_m double precision check (accuracy_m is null or accuracy_m >= 0),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_addresses_one_default_per_user
  on public.customer_addresses (user_id) where is_default;
create index if not exists customer_addresses_user_idx
  on public.customer_addresses (user_id, created_at);

alter table public.customer_addresses enable row level security;
revoke all on public.customer_addresses from anon, authenticated;

-- Address-book access is mediated by authenticated server routes. Coordinates
-- therefore never become directly listable through the public REST role.
