-- Individually identified laptops use the sheet wholesale price from one unit.
-- Other tabs retain their existing minimum of three per product.
begin;

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
    if price_value is not null and (minimum is null or minimum < case when product_record.source_sheet='Laptops' and product_record.source_key like 'production:laptops:unit:%' then 1 else 3 end or minimum>10000 or price_value<=0 or product_record.price<=0 or price_value>product_record.price) then raise exception 'Invalid wholesale price or minimum quantity'; end if;
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
update public.price_lists set description='Sheet-managed wholesale MMK prices. Verified businesses only; individually identified laptops from one unit, other products at their configured minimum.' where name='Sheet B2B (MMK)';
notify pgrst,'reload schema';
commit;
