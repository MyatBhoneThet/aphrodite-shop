-- Prevent duplicate orders from concurrent checkouts by the same user.
-- Apply after 2026-07-29-customer-settings-recently-viewed.sql.
--
-- Problem: checkout_order() validated the caller's cart rows BEFORE taking
-- any lock. Two simultaneous checkout requests for the same user (double
-- click past the UI guard, a retried request, two tabs) could both see the
-- same still-present cart rows, both pass validation, and both insert an
-- order -- deducting inventory twice for one intended purchase.
--
-- Fix: lock the user's cart rows first. The second transaction blocks on the
-- row locks; when the first commits (which deletes the cart), the second
-- resumes, sees no cart rows, and fails the existing count check with
-- CART_CHANGED instead of creating a duplicate order.
--
-- This migration recreates checkout_order() with the same signature, so
-- existing grants are re-stated below.
--
-- Verification (run in the Supabase SQL editor after applying):
--   1. Single checkout still works end to end from the storefront.
--   2. Concurrency: in two separate SQL sessions with an existing cart for
--      user :uid, run in session A:
--        begin;
--        select public.checkout_order(:uid, 'n','p','a','a1',null,'c','s','z','TH','cash_on_delivery',null,:lines);
--      (leave uncommitted), then in session B run the same call -- B must
--      block. After `commit;` in A, B must fail with CART_CHANGED and no
--      second order row may exist:
--        select count(*) from public.orders where user_id = :uid
--          and created_at > now() - interval '5 minutes';
--   3. Grants: anon/authenticated must NOT be able to execute the function:
--        select has_function_privilege('anon',
--          'public.checkout_order(uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb)',
--          'execute');  -- expect f

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

  if p_payment_method <> 'cash_on_delivery' then
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
    payment_method, payment_status, notes
  )
  values (
    p_user_id, 'pending', v_total, p_shipping_name, p_shipping_phone,
    p_shipping_address, p_shipping_address_line1, p_shipping_address_line2,
    p_shipping_city, p_shipping_state, p_shipping_postal_code, p_shipping_country,
    p_payment_method, 'unpaid', p_notes
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
