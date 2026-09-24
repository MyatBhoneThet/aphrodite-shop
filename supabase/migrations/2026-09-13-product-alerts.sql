-- Back-in-stock and price-drop alerts.
--
-- Customers "follow" a product that is out of stock or above their budget, and
-- the storefront shows them when that changes.
--
-- Design note: the alert stores a BASELINE snapshot of the product's price and
-- stock at the moment the customer started following it. Whether an alert has
-- fired is then decided by comparing that baseline with the product's current
-- row, live, whenever the customer loads a page. The catalogue synchronizer
-- now uses that same comparison for email and advances the stored baseline
-- after a successful notification -- see app/lib/product-alerts.ts.
--
-- Apply after 2026-07-29-customer-settings-recently-viewed.sql.

create table if not exists public.product_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  product_id integer not null
    references public.products(id) on delete cascade,
  kind text not null,
  -- Product state when the customer started following.
  baseline_price integer not null default 0,
  baseline_stock text not null default 'Out of Stock',
  -- Optional ceiling for a price-drop alert ("tell me under 3,000,000").
  target_price integer,
  created_at timestamptz not null default now(),
  -- One alert of each kind per product per customer.
  unique (user_id, product_id, kind)
);

alter table public.product_alerts
  drop constraint if exists product_alerts_kind_check;
alter table public.product_alerts
  add constraint product_alerts_kind_check
  check (kind in ('back_in_stock', 'price_drop'));

alter table public.product_alerts
  drop constraint if exists product_alerts_baseline_stock_check;
alter table public.product_alerts
  add constraint product_alerts_baseline_stock_check
  check (baseline_stock in ('In Stock', 'Out of Stock'));

alter table public.product_alerts
  drop constraint if exists product_alerts_target_price_check;
alter table public.product_alerts
  add constraint product_alerts_target_price_check
  check (target_price is null or target_price > 0);

create index if not exists product_alerts_user_created_idx
  on public.product_alerts (user_id, created_at desc);

create index if not exists product_alerts_product_idx
  on public.product_alerts (product_id);

alter table public.product_alerts enable row level security;

-- Alerts are read and written only by the server routes, which use the
-- service role after checking the customer's identity. Browser roles must not
-- be able to read or change another customer's alerts.
revoke all on table public.product_alerts
  from public, anon, authenticated;
grant select, insert, update, delete on table public.product_alerts
  to service_role;

-- Explicit deny policies so the intent is visible to Supabase's RLS advisor,
-- matching customer_location_shares.
drop policy if exists product_alerts_no_browser_read on public.product_alerts;
create policy product_alerts_no_browser_read
  on public.product_alerts
  for select to anon, authenticated
  using (false);

drop policy if exists product_alerts_no_browser_write on public.product_alerts;
create policy product_alerts_no_browser_write
  on public.product_alerts
  for all to anon, authenticated
  using (false)
  with check (false);

notify pgrst, 'reload schema';
