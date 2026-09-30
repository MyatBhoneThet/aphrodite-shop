-- Bank transfer (KBZ / AYA) and MMQR payments with an uploaded transfer slip
-- that an admin verifies before the order may be confirmed or shipped.
--
-- Cash on delivery is unchanged: those orders keep payment_verification_status
-- 'not_required' and continue to use the COD callback review.
--
-- Idempotent: safe to run more than once (the live database has drifted from
-- this folder before, so every statement guards itself).

-- 1. Orders: allow the new methods and record how payment was checked.
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('cash_on_delivery', 'bank_transfer', 'mmqr'));

alter table public.orders
  add column if not exists payment_account text,
  add column if not exists payment_reference text,
  add column if not exists payment_verification_status text not null default 'not_required',
  add column if not exists payment_verified_at timestamptz,
  add column if not exists payment_verified_by uuid references public.profiles(id) on delete set null,
  add column if not exists payment_rejected_reason text;

alter table public.orders drop constraint if exists orders_payment_account_check;
alter table public.orders add constraint orders_payment_account_check
  check (payment_account is null or payment_account in ('kbz', 'aya', 'mmqr'));

alter table public.orders drop constraint if exists orders_payment_verification_check;
alter table public.orders add constraint orders_payment_verification_check
  check (payment_verification_status in ('not_required', 'pending', 'verified', 'rejected'));

-- 2. The slips themselves. Files live in the private "payment-slips" bucket;
--    only the storage path is stored here, and reads are signed server-side.
create table if not exists public.payment_slips (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  file_name text,
  content_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 0 and 10485760),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists payment_slips_order_time_idx
  on public.payment_slips(order_id, created_at asc);

alter table public.payment_slips enable row level security;
revoke all on table public.payment_slips from anon, authenticated;
grant select on table public.payment_slips to authenticated;
grant all on table public.payment_slips to service_role;

drop policy if exists "Customers read own payment slips" on public.payment_slips;
create policy "Customers read own payment slips" on public.payment_slips
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = (select auth.uid())
    )
  );

drop policy if exists "Admins read every payment slip" on public.payment_slips;
create policy "Admins read every payment slip" on public.payment_slips
  for select to authenticated
  using ((select public.is_admin()));

-- 3. checkout_order: accept the new methods and mark prepaid orders as
--    awaiting a slip. Everything else is unchanged from
--    2026-07-30-checkout-concurrency.sql.
create or replace function public.checkout_order(
  p_user_id uuid,
  p_shipping_name text,
  p_shipping_phone text,
  p_shipping_address text,
  p_shipping_address_line1 text,
  p_shipping_address_line2 text,
  p_shipping_city text,
  p_shipping_state text,
  p_shipping_postal_code text,
  p_shipping_country text,
  p_payment_method text,
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

  if p_payment_method not in ('cash_on_delivery', 'bank_transfer', 'mmqr') then
    raise exception 'INVALID_PAYMENT_METHOD' using errcode = 'P0001';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'CART_EMPTY' using errcode = 'P0001';
  end if;

  -- Serialize concurrent checkouts for the same user (see header comment).
  perform 1 from public.cart_items where user_id = p_user_id for update;

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

  insert into public.orders (
    user_id, status, total_amount, shipping_name, shipping_phone,
    shipping_address, shipping_address_line1, shipping_address_line2,
    shipping_city, shipping_state, shipping_postal_code, shipping_country,
    payment_method, payment_status, payment_verification_status, notes
  )
  values (
    p_user_id, 'pending', v_total, p_shipping_name, p_shipping_phone,
    p_shipping_address, p_shipping_address_line1, p_shipping_address_line2,
    p_shipping_city, p_shipping_state, p_shipping_postal_code, p_shipping_country,
    p_payment_method, 'unpaid',
    case when p_payment_method = 'cash_on_delivery' then 'not_required' else 'pending' end,
    p_notes
  )
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

revoke execute on function public.checkout_order(
  uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb
)
  from public, anon, authenticated;
grant execute on function public.checkout_order(
  uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb
)
  to service_role;

notify pgrst, 'reload schema';
