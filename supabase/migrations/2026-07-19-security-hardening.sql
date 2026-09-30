-- Product column confidentiality and order-query indexes.
-- Apply after 2026-07-15-wholesale-tier-pricing.sql.

begin;

-- Row-level security cannot hide individual columns. Public/authenticated
-- callers get only the catalog fields used by explicit application queries;
-- exact inventory and the legacy wholesale price remain service-role-only.
revoke select on public.products from anon, authenticated;
grant select (
  id, name, type, category, brand, price, image, model_3d, stock, specs, full_specs
) on public.products to anon, authenticated;

create index if not exists orders_user_created_idx
  on public.orders (user_id, created_at desc);

create index if not exists orders_created_idx
  on public.orders (created_at desc);

create index if not exists order_items_order_idx
  on public.order_items (order_id);

commit;
