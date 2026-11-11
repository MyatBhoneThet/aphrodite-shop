-- Preserve standard checkout for manually added products with no sheet source.
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
notify pgrst,'reload schema';
