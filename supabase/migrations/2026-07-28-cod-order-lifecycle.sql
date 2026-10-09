-- COD delivery details and customer cancellation/return lifecycle.
-- Apply after 2026-07-19-security-hardening.sql.

alter table public.orders
  add column if not exists shipping_address_line1 text,
  add column if not exists shipping_address_line2 text,
  add column if not exists shipping_city text,
  add column if not exists shipping_state text,
  add column if not exists shipping_postal_code text,
  add column if not exists shipping_country text,
  add column if not exists payment_method text not null default 'cash_on_delivery',
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists cancellation_request_status text not null default 'none',
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_requested_at timestamptz,
  add column if not exists cancellation_resolved_at timestamptz,
  add column if not exists return_request_status text not null default 'none',
  add column if not exists return_reason text,
  add column if not exists return_requested_at timestamptz,
  add column if not exists return_resolved_at timestamptz,
  add column if not exists admin_order_note text;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending','confirmed','shipped','delivered','cancelled','returned'));
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('cash_on_delivery'));
alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('unpaid','collected','refunded'));
alter table public.orders drop constraint if exists orders_cancellation_request_status_check;
alter table public.orders add constraint orders_cancellation_request_status_check
  check (cancellation_request_status in ('none','requested','approved','rejected'));
alter table public.orders drop constraint if exists orders_return_request_status_check;
alter table public.orders add constraint orders_return_request_status_check
  check (return_request_status in ('none','requested','approved','rejected'));

create index if not exists orders_cancellation_request_idx
  on public.orders (cancellation_request_status, created_at desc);
create index if not exists orders_return_request_idx
  on public.orders (return_request_status, created_at desc);

drop function if exists public.checkout_order(uuid,text,text,text,text,jsonb);
drop function if exists public.checkout_order(
  uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb
);

create function public.checkout_order(
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
  if p_lines is null or jsonb_typeof(p_lines) <> 'array'
    or jsonb_array_length(p_lines) = 0 then
    raise exception 'CART_EMPTY' using errcode = 'P0001';
  end if;

  select count(*) into v_cart_count
  from public.cart_items where user_id = p_user_id;
  select count(*) into v_line_count from jsonb_array_elements(p_lines);
  if v_cart_count <> v_line_count then
    raise exception 'CART_CHANGED' using errcode = 'P0001';
  end if;

  for v_line in
    select
      (value->>'product_id')::integer product_id,
      (value->>'quantity')::integer quantity,
      (value->>'unit_price')::integer unit_price
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
    user_id,status,total_amount,shipping_name,shipping_phone,shipping_address,
    shipping_address_line1,shipping_address_line2,shipping_city,shipping_state,
    shipping_postal_code,shipping_country,payment_method,payment_status,notes
  ) values (
    p_user_id,'pending',v_total,p_shipping_name,p_shipping_phone,p_shipping_address,
    p_shipping_address_line1,p_shipping_address_line2,p_shipping_city,p_shipping_state,
    p_shipping_postal_code,p_shipping_country,p_payment_method,'unpaid',p_notes
  ) returning id into v_order_id;

  for v_line in
    select
      (value->>'product_id')::integer product_id,
      (value->>'quantity')::integer quantity,
      (value->>'unit_price')::integer unit_price,
      (value->>'retail_unit_price')::integer retail_unit_price,
      nullif(value->>'price_list_id','')::uuid price_list_id,
      nullif(value->>'tier_id','')::uuid tier_id,
      nullif(value->>'tier_min_quantity','')::integer tier_min_quantity
    from jsonb_array_elements(p_lines)
  loop
    select id,stock_quantity into v_product
    from public.products where id = v_line.product_id for update;
    if v_product.id is null then
      raise exception 'PRODUCT_NOT_FOUND:%',v_line.product_id using errcode = 'P0001';
    end if;
    if v_product.stock_quantity < v_line.quantity then
      raise exception 'INSUFFICIENT_STOCK:%:%',
        v_line.product_id,v_product.stock_quantity using errcode = 'P0001';
    end if;
    update public.products
      set stock_quantity = stock_quantity - v_line.quantity
      where id = v_line.product_id;
    insert into public.order_items (
      order_id,product_id,quantity,unit_price,retail_unit_price,
      price_list_id,tier_id,tier_min_quantity
    ) values (
      v_order_id,v_line.product_id,v_line.quantity,v_line.unit_price,
      v_line.retail_unit_price,v_line.price_list_id,v_line.tier_id,
      v_line.tier_min_quantity
    );
  end loop;

  delete from public.cart_items where user_id = p_user_id;
  return jsonb_build_object('order_id',v_order_id,'total_amount',v_total);
end;
$$;

create or replace function public.request_order_action(
  p_user_id uuid,p_order_id uuid,p_request_type text,p_reason text
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders
    where id=p_order_id and user_id=p_user_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0001'; end if;
  if length(trim(coalesce(p_reason,''))) < 3 then
    raise exception 'INVALID_REQUEST_REASON' using errcode='P0001';
  end if;
  if p_request_type='cancellation' then
    if v_order.status not in ('pending','confirmed') then
      raise exception 'CANCELLATION_NOT_ALLOWED' using errcode='P0001';
    end if;
    if v_order.cancellation_request_status='requested' then
      raise exception 'REQUEST_ALREADY_PENDING' using errcode='P0001';
    end if;
    update public.orders set cancellation_request_status='requested',
      cancellation_reason=trim(p_reason),cancellation_requested_at=now(),
      cancellation_resolved_at=null,admin_order_note=null where id=p_order_id;
  elsif p_request_type='return' then
    if v_order.status<>'delivered' then
      raise exception 'RETURN_NOT_ALLOWED' using errcode='P0001';
    end if;
    if v_order.return_request_status='requested' then
      raise exception 'REQUEST_ALREADY_PENDING' using errcode='P0001';
    end if;
    update public.orders set return_request_status='requested',
      return_reason=trim(p_reason),return_requested_at=now(),
      return_resolved_at=null,admin_order_note=null where id=p_order_id;
  else raise exception 'INVALID_REQUEST_TYPE' using errcode='P0001';
  end if;
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.resolve_order_action(
  p_actor_id uuid,p_order_id uuid,p_request_type text,p_decision text,p_admin_note text
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_order public.orders%rowtype;
begin
  if not exists(select 1 from public.profiles where id=p_actor_id and role='admin')
    then raise exception 'FORBIDDEN' using errcode='P0001'; end if;
  if p_decision not in ('approve','reject') then
    raise exception 'INVALID_DECISION' using errcode='P0001'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0001'; end if;

  if p_request_type='cancellation' then
    if v_order.cancellation_request_status<>'requested' then
      raise exception 'REQUEST_NOT_PENDING' using errcode='P0001'; end if;
    if p_decision='approve' then
      if v_order.status not in ('pending','confirmed') then
        raise exception 'CANCELLATION_NOT_ALLOWED' using errcode='P0001'; end if;
      update public.products p set stock_quantity=p.stock_quantity+i.quantity
        from public.order_items i
        where i.order_id=p_order_id and p.id=i.product_id;
      update public.orders set status='cancelled',
        cancellation_request_status='approved',cancellation_resolved_at=now(),
        admin_order_note=nullif(trim(coalesce(p_admin_note,'')),'')
        where id=p_order_id;
    else
      update public.orders set cancellation_request_status='rejected',
        cancellation_resolved_at=now(),
        admin_order_note=nullif(trim(coalesce(p_admin_note,'')),'')
        where id=p_order_id;
    end if;
  elsif p_request_type='return' then
    if v_order.return_request_status<>'requested' then
      raise exception 'REQUEST_NOT_PENDING' using errcode='P0001'; end if;
    if p_decision='approve' then
      if v_order.status<>'delivered' then
        raise exception 'RETURN_NOT_ALLOWED' using errcode='P0001'; end if;
      update public.products p set stock_quantity=p.stock_quantity+i.quantity
        from public.order_items i
        where i.order_id=p_order_id and p.id=i.product_id;
      update public.orders set status='returned',payment_status='refunded',
        return_request_status='approved',return_resolved_at=now(),
        admin_order_note=nullif(trim(coalesce(p_admin_note,'')),'')
        where id=p_order_id;
    else
      update public.orders set return_request_status='rejected',
        return_resolved_at=now(),
        admin_order_note=nullif(trim(coalesce(p_admin_note,'')),'')
        where id=p_order_id;
    end if;
  else raise exception 'INVALID_REQUEST_TYPE' using errcode='P0001';
  end if;

  insert into public.audit_log(
    actor_id,action,target_type,target_id,previous_data,new_data
  ) values (
    p_actor_id,'order.'||p_request_type||'.'||p_decision,'order',p_order_id::text,
    jsonb_build_object('status',v_order.status,
      'cancellation_request_status',v_order.cancellation_request_status,
      'return_request_status',v_order.return_request_status),
    jsonb_build_object('decision',p_decision,'admin_note',p_admin_note)
  );
  return jsonb_build_object('ok',true);
end;
$$;

revoke execute on function public.checkout_order(
  uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb
) from public,anon,authenticated;
grant execute on function public.checkout_order(
  uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb
) to service_role;
revoke execute on function public.request_order_action(uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.request_order_action(uuid,uuid,text,text)
  to service_role;
revoke execute on function public.resolve_order_action(uuid,uuid,text,text,text)
  from public,anon,authenticated;
grant execute on function public.resolve_order_action(uuid,uuid,text,text,text)
  to service_role;

-- Make the new RPC signatures available to PostgREST immediately. Merely
-- saving this file in the project does not change a remote Supabase database;
-- run the complete migration in the Supabase SQL Editor.
notify pgrst, 'reload schema';
