-- One purchasable model/specification pool, with private physical-unit stock.
begin;
alter table public.products add column if not exists sheet_units jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists available_quantity integer generated always as
  (case when source_key like 'production:laptops:pool:%' then stock_quantity else null end) stored;
alter table public.order_items add column if not exists allocated_units jsonb not null default '[]'::jsonb;
revoke select(sheet_units) on public.products from anon,authenticated;
grant select(available_quantity) on public.products to anon,authenticated;
grant select,update(sheet_units) on public.products to service_role;
grant select,insert,update(allocated_units) on public.order_items to service_role;

-- A sheet outage must not resurrect a reserved serial. pending_quantity is
-- cleared only when the workbook acknowledges the requested 0/1 value.
create or replace function public.reconcile_laptop_unit_inventory() returns trigger
language plpgsql security definer set search_path='' as $$
declare incoming jsonb; previous jsonb; legacy public.products; merged jsonb := '[]'::jsonb; total integer:=0; q integer;
begin
  if coalesce(new.source_key,'') not like 'production:laptops:pool:%' then return new; end if;
  if jsonb_typeof(new.sheet_units)<>'array' then raise exception 'Invalid laptop units'; end if;
  for incoming in select value from jsonb_array_elements(new.sheet_units) loop
    q:=(incoming->>'quantity')::integer;
    if q is null or q not in (0,1) or coalesce(incoming->>'key','')='' or coalesce(incoming->>'code','')='' or coalesce(incoming->>'serialNumber','')='' then
      raise exception 'Invalid laptop unit identity or availability';
    end if;
    if tg_op='INSERT' then
      -- Carry outstanding deductions/restorations from the old serial listing
      -- into the new pool, including a sale committed during deployment.
      select * into legacy from public.products where source_key=incoming->>'key';
      if found and legacy.sheet_stock_quantity is not null and legacy.stock_quantity is distinct from legacy.sheet_stock_quantity then
        if legacy.stock_quantity in (0,1) and legacy.stock_quantity<>q then
          incoming:=incoming || jsonb_build_object('quantity',legacy.stock_quantity,'pending_quantity',legacy.stock_quantity);
        end if;
      end if;
    end if;
    if tg_op='UPDATE' and not (incoming ? 'pending_quantity') then
      select value into previous from jsonb_array_elements(old.sheet_units) where value->>'key'=incoming->>'key';
      if previous ? 'pending_quantity' and (previous->>'pending_quantity')::integer <> q then
        incoming:=incoming || jsonb_build_object('quantity',(previous->>'pending_quantity')::integer,'pending_quantity',(previous->>'pending_quantity')::integer);
      end if;
    end if;
    total:=total+(incoming->>'quantity')::integer;
    merged:=merged || jsonb_build_array(incoming);
  end loop;
  if (select count(distinct value->>'key') from jsonb_array_elements(merged))<>jsonb_array_length(merged) then raise exception 'Duplicate laptop serial identity'; end if;
  new.sheet_units:=merged;
  new.stock_quantity:=total;
  new.stock:=case when total>0 then 'In Stock' else 'Out of Stock' end;
  return new;
end $$;
create trigger reconcile_laptop_unit_inventory before insert or update of sheet_units on public.products
for each row execute function public.reconcile_laptop_unit_inventory();

-- checkout_order already locks/decrements the model stock in its transaction.
-- This trigger reserves distinct random serials and snapshots them on the line.
create or replace function public.allocate_order_laptop_units() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.products; chosen jsonb; updated jsonb;
begin
  select * into p from public.products where id=new.product_id for update;
  if coalesce(p.source_key,'') not like 'production:laptops:pool:%' then return new; end if;
  select coalesce(jsonb_agg(unit - 'pending_quantity'),'[]'::jsonb) into chosen from (
    select value as unit from jsonb_array_elements(p.sheet_units)
    where (value->>'quantity')::integer=1 order by random() limit new.quantity
  ) pick;
  if jsonb_array_length(chosen)<>new.quantity then raise exception 'INSUFFICIENT_STOCK:%:%',new.product_id,jsonb_array_length(chosen); end if;
  select jsonb_agg(case when exists(select 1 from jsonb_array_elements(chosen) c where c->>'key'=u->>'key')
    then u || jsonb_build_object('quantity',0,'pending_quantity',0) else u end)
    into updated from jsonb_array_elements(p.sheet_units) u;
  update public.products set sheet_units=updated where id=p.id;
  new.allocated_units:=chosen;
  return new;
end $$;
create trigger allocate_order_laptop_units before insert on public.order_items
for each row execute function public.allocate_order_laptop_units();

-- Restore the exact serials on cancellation or an approved full-order restock.
create or replace function public.restore_order_laptop_units() returns trigger
language plpgsql security definer set search_path='' as $$
declare line record; p public.products; restored jsonb;
begin
  if not ((new.status='cancelled' and old.status is distinct from 'cancelled') or
    (new.return_restock_approved is true and old.return_restock_approved is distinct from true)) then return new; end if;
  for line in select product_id,allocated_units from public.order_items where order_id=new.id and jsonb_array_length(allocated_units)>0 loop
    select * into p from public.products where id=line.product_id for update;
    if p.full_specs ? 'replacementProductId' then
      select * into p from public.products where id=(p.full_specs->>'replacementProductId')::integer for update;
    end if;
    select jsonb_agg(case when exists(select 1 from jsonb_array_elements(line.allocated_units) a where a->>'key'=u->>'key')
      then u || jsonb_build_object('quantity',1,'pending_quantity',1) else u end)
      into restored from jsonb_array_elements(p.sheet_units) u;
    update public.products set sheet_units=restored where id=p.id;
  end loop;
  return new;
end $$;
create trigger restore_order_laptop_units after update of status,return_restock_approved on public.orders
for each row execute function public.restore_order_laptop_units();

revoke all on function public.reconcile_laptop_unit_inventory() from public,anon,authenticated;
revoke all on function public.allocate_order_laptop_units() from public,anon,authenticated;
revoke all on function public.restore_order_laptop_units() from public,anon,authenticated;

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
  p_cart_item_ids uuid[],
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_total bigint := 0;
  v_line record;
  v_product record;
  v_cart_quantity integer;
  v_selected_count integer;
  v_product_count integer;
  v_line_count integer;
begin
  if p_user_id is null then
    raise exception 'checkout_order: user id is required' using errcode = 'P0001';
  end if;
  if p_payment_method not in ('cash_on_delivery', 'bank_transfer', 'mmqr') then
    raise exception 'INVALID_PAYMENT_METHOD' using errcode = 'P0001';
  end if;
  if coalesce(array_length(p_cart_item_ids, 1), 0) = 0 then
    raise exception 'CART_EMPTY' using errcode = 'P0001';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'CART_EMPTY' using errcode = 'P0001';
  end if;

  perform 1 from public.cart_items
  where user_id = p_user_id and id = any(p_cart_item_ids)
  for update;

  select count(*), count(distinct product_id)
  into v_selected_count, v_product_count
  from public.cart_items
  where user_id = p_user_id and id = any(p_cart_item_ids);

  select count(*) into v_line_count from jsonb_array_elements(p_lines);
  if v_selected_count <> array_length(p_cart_item_ids, 1)
    or v_product_count <> v_line_count then
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

    select sum(quantity)::integer into v_cart_quantity
    from public.cart_items
    where user_id = p_user_id
      and id = any(p_cart_item_ids)
      and product_id = v_line.product_id;

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
  ) values (
    p_user_id, 'pending', v_total, p_shipping_name, p_shipping_phone,
    p_shipping_address, p_shipping_address_line1, p_shipping_address_line2,
    p_shipping_city, p_shipping_state, p_shipping_postal_code, p_shipping_country,
    p_payment_method, 'unpaid',
    case when p_payment_method = 'cash_on_delivery' then 'not_required' else 'pending' end,
    p_notes
  ) returning id into v_order_id;

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
    select id, stock_quantity into v_product
    from public.products where id = v_line.product_id for update;
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

  delete from public.cart_items
  where user_id = p_user_id and id = any(p_cart_item_ids);

  return jsonb_build_object('order_id', v_order_id, 'total_amount', v_total, 'allocations', (select coalesce(jsonb_agg(jsonb_build_object('product_id',product_id,'units',allocated_units)), '[]'::jsonb) from public.order_items where order_id=v_order_id and jsonb_array_length(allocated_units)>0));
end;
$$;

revoke execute on function public.checkout_order(
  uuid, text, text, text, text, text, text, text, text, text, text, text, uuid[], jsonb
) from public, anon, authenticated;
grant execute on function public.checkout_order(
  uuid, text, text, text, text, text, text, text, text, text, text, text, uuid[], jsonb
) to service_role;


create or replace function public.sync_sheet_b2b(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare list_id uuid; row_data jsonb; product_record public.products; price_value integer; minimum integer; synced integer:=0;
begin
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>10000 then raise exception 'Invalid wholesale rows'; end if;
  perform pg_advisory_xact_lock(713461);
  select id into list_id from public.price_lists where name='Sheet B2B (MMK)';
  if list_id is null then raise exception 'Missing Sheet B2B (MMK) list'; end if;
  for row_data in select value from jsonb_array_elements(p_rows) loop
    select * into product_record from public.products where source_key=row_data->>'source_key' for update;
    if not found then raise exception 'Product must be synced before wholesale pricing'; end if;
    price_value:=(row_data->>'unit_price')::integer; minimum:=(row_data->>'min_quantity')::integer;
    if price_value is not null and (minimum is null or minimum < case when product_record.source_sheet='Laptops' and (product_record.source_key like 'production:laptops:unit:%' or product_record.source_key like 'production:laptops:pool:%') then 1 else 3 end or minimum>10000 or price_value<=0 or product_record.price<=0 or price_value>product_record.price) then raise exception 'Invalid wholesale price or minimum quantity'; end if;
    update public.product_price_tiers set is_active=false where price_list_id=list_id and product_id=product_record.id;
    if price_value is not null then
      insert into public.product_price_tiers(price_list_id,product_id,min_quantity,unit_price,is_active)
        values(list_id,product_record.id,minimum,price_value,true)
      on conflict(price_list_id,product_id,min_quantity) do update set unit_price=excluded.unit_price,is_active=true,effective_from=null,effective_to=null;
      synced:=synced+1;
    end if;
  end loop;
  return jsonb_build_object('synced',synced,'price_list_id',list_id);
end $$;


revoke all on function public.sync_sheet_b2b(jsonb) from public,anon,authenticated;
grant execute on function public.sync_sheet_b2b(jsonb) to service_role;

-- Old serial URLs and carts continue to point at the shared product.
create or replace function public.link_laptop_pool_aliases(p_pools jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare pool jsonb; canonical_id integer; alias_row public.products; cart_row public.cart_items;
begin
  for pool in select value from jsonb_array_elements(p_pools) loop
    select id into canonical_id from public.products where source_key=pool->>'source_key';
    if canonical_id is null then raise exception 'Pool must be synced first'; end if;
    for alias_row in select * from public.products where source_key in (select jsonb_array_elements_text(pool->'unit_keys')) loop
      for cart_row in select * from public.cart_items where product_id=alias_row.id and build_group_id is null for update loop
        insert into public.cart_items(user_id,product_id,quantity) values(cart_row.user_id,canonical_id,cart_row.quantity)
        on conflict(user_id,product_id) where build_group_id is null do update set quantity=public.cart_items.quantity+excluded.quantity;
        delete from public.cart_items where id=cart_row.id;
      end loop;
      update public.order_items set allocated_units=(select jsonb_agg(u) from public.products cp, jsonb_array_elements(cp.sheet_units) u where cp.id=canonical_id and u->>'key'=alias_row.source_key)
        where product_id=alias_row.id and quantity=1 and jsonb_array_length(allocated_units)=0;
      update public.products set stock_quantity=0, sheet_stock_quantity=0, stock='Out of Stock',
        full_specs=full_specs || jsonb_build_object('archived',true,'replacementProductId',canonical_id)
        where id=alias_row.id;
    end loop;
  end loop;
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.link_laptop_pool_aliases(jsonb) from public,anon,authenticated;
grant execute on function public.link_laptop_pool_aliases(jsonb) to service_role;

notify pgrst,'reload schema';
commit;
