-- Requires the delivery/RMA migration and wholesale tier pricing schema.
-- No order totals, historical payments, inventory quantities or account roles are rewritten.
begin;

alter table public.profiles add column if not exists business_name text;
alter table public.profiles add column if not exists business_verified_at timestamptz;
-- Self-service must never be able to grant a role or B2B verification.
revoke update on public.profiles from anon, authenticated;
grant update(full_name,phone,shipping_address_line1,shipping_address_line2,
  shipping_city,shipping_state,shipping_postal_code,shipping_country,
  preferred_language,order_updates_enabled,support_updates_enabled,marketing_emails_enabled)
  on public.profiles to authenticated;
revoke update(role,wholesale_status,price_list_id,business_name,business_verified_at)
  on public.profiles from anon,authenticated;

-- A public row policy cannot hide wholesale/cost columns.
revoke select on public.products from anon,authenticated;
revoke select(wholesale_price,stock_quantity,sheet_stock_quantity,source_key)
  on public.products from anon,authenticated;
grant select(id,name,type,category,brand,price,image,model_3d,stock,specs,full_specs,source_sheet,images)
  on public.products to anon,authenticated;

drop policy if exists "Assigned wholesale users read own price list" on public.price_lists;
create policy "Assigned wholesale users read own price list" on public.price_lists for select to authenticated
using (is_active and exists(select 1 from public.profiles p where p.id=(select auth.uid())
  and p.role='wholesale' and p.wholesale_status='approved' and p.business_verified_at is not null and p.price_list_id=price_lists.id));
drop policy if exists "Assigned wholesale users read own tiers" on public.product_price_tiers;
create policy "Assigned wholesale users read own tiers" on public.product_price_tiers for select to authenticated
using (is_active and exists(select 1 from public.profiles p join public.price_lists l on l.id=p.price_list_id
  where p.id=(select auth.uid()) and p.role='wholesale' and p.wholesale_status='approved'
  and p.business_verified_at is not null and l.is_active and p.price_list_id=product_price_tiers.price_list_id));

create table if not exists public.cod_reviews (
  order_id uuid primary key references public.orders(id) on delete cascade,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz not null default now(),
  callback_confirmed boolean not null default false,
  address_confirmed boolean not null default false,
  decision text not null check(decision in ('pending','phone_verified','approved','rejected')),
  note text not null check(char_length(note)<=500),
  order_snapshot jsonb not null
);
alter table public.cod_reviews enable row level security;
revoke all on public.cod_reviews from public,anon,authenticated;
grant select on public.cod_reviews to authenticated;
grant all on public.cod_reviews to service_role;
drop policy if exists "Only admins read COD checks" on public.cod_reviews;
create policy "Only admins read COD checks" on public.cod_reviews for select to authenticated using ((select public.is_admin()));
create index if not exists cod_reviews_reviewer_idx on public.cod_reviews(reviewed_by);
create index if not exists orders_cod_pending_user_idx on public.orders(user_id) where status='pending' and payment_status='unpaid';

create or replace function public.cod_order_snapshot(o public.orders) returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_build_object('phone',o.shipping_phone,'name',o.shipping_name,'address',o.shipping_address,
    'line1',o.shipping_address_line1,'line2',o.shipping_address_line2,'city',o.shipping_city,
    'state',o.shipping_state,'country',o.shipping_country,'postal',o.shipping_postal_code,'total',o.total_amount)
$$;
revoke all on function public.cod_order_snapshot(public.orders) from public,anon,authenticated;
grant execute on function public.cod_order_snapshot(public.orders) to service_role;

create or replace function public.guard_cod_fulfilment() returns trigger
language plpgsql security definer set search_path='' as $$
declare r public.cod_reviews;
begin
  if new.payment_method <> 'cash_on_delivery' then return new; end if;
  if tg_op='INSERT' then
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,7341));
    if (select count(*) from public.orders where user_id=new.user_id and status='pending' and payment_status='unpaid')>=3 then
      raise exception 'COD_OPEN_LIMIT';
    end if;
    if new.status<>'pending' or new.cod_verification_status<>'pending' then raise exception 'COD_REVIEW_REQUIRED'; end if;
    return new;
  end if;
  if public.cod_order_snapshot(new) is distinct from public.cod_order_snapshot(old) then
    if old.status in ('shipped','delivered') then raise exception 'COD_ORDER_CLOSED'; end if;
    new.cod_verification_status:='pending'; new.cod_verification_method:=null; new.cod_verified_at:=null;
  end if;
  if (new.cod_verification_status is distinct from old.cod_verification_status and new.cod_verification_status in ('approved','phone_verified')) or
    (new.status is distinct from old.status and new.status in ('confirmed','shipped','delivered')) then
    select * into r from public.cod_reviews where order_id=new.id;
    if r.order_id is null or not r.callback_confirmed or char_length(trim(r.note))<10
      or r.order_snapshot is distinct from public.cod_order_snapshot(new) then raise exception 'COD_REVIEW_REQUIRED'; end if;
    if new.cod_verification_status='approved' and (not r.address_confirmed or r.decision<>'approved') then raise exception 'COD_REVIEW_REQUIRED'; end if;
    if new.status is distinct from old.status and new.status in ('confirmed','shipped','delivered') then
      if new.cod_verification_status<>'approved' or r.decision<>'approved' or not r.address_confirmed then raise exception 'COD_REVIEW_REQUIRED'; end if;
      if new.status in ('shipped','delivered') and (nullif(trim(new.courier_name),'') is null or nullif(trim(new.delivery_tracking_number),'') is null) then raise exception 'COD_COURIER_REQUIRED'; end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_cod_fulfilment() from public,anon,authenticated;
drop trigger if exists guard_cod_fulfilment on public.orders;
create trigger guard_cod_fulfilment before insert or update on public.orders for each row execute function public.guard_cod_fulfilment();

create or replace function public.review_cod_delivery(p_actor_id uuid,p_order_id uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.orders; decision text:=p_input->>'verification_status'; stage text:=nullif(p_input->>'stage','');
  callback boolean:=coalesce((p_input->>'callback_confirmed')::boolean,false);
  address_ok boolean:=coalesce((p_input->>'address_confirmed')::boolean,false);
  note_text text:=coalesce(trim(p_input->>'verification_note'),'');
begin
  if not exists(select 1 from public.profiles where id=p_actor_id and role='admin') then raise exception 'Forbidden'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status in ('cancelled','returned') then raise exception 'COD_ORDER_CLOSED'; end if;
  if decision is null or decision not in ('pending','phone_verified','approved','rejected') or char_length(note_text)>500 then raise exception 'COD_REVIEW_REQUIRED'; end if;
  if decision in ('phone_verified','approved') and (not callback or char_length(note_text)<10) then raise exception 'COD_REVIEW_REQUIRED'; end if;
  if decision='approved' and (not address_ok or nullif(trim(o.shipping_phone),'') is null or nullif(trim(o.shipping_address),'') is null
    or lower(trim(coalesce(o.shipping_country,''))) not in ('myanmar','mm','mmr','burma')) then raise exception 'COD_REVIEW_REQUIRED'; end if;
  if stage in ('packed','handed_to_courier','in_transit','out_for_delivery','delivered') and decision<>'approved' then raise exception 'COD_REVIEW_REQUIRED'; end if;
  if stage='verified' and decision not in ('phone_verified','approved') then raise exception 'COD_REVIEW_REQUIRED'; end if;
  if stage in ('handed_to_courier','in_transit','out_for_delivery','delivered') and
    (nullif(trim(p_input->>'courier_name'),'') is null or nullif(trim(p_input->>'tracking_number'),'') is null) then raise exception 'COD_COURIER_REQUIRED'; end if;
  if (stage='delivered' and o.status<>'delivered') or (stage in ('handed_to_courier','in_transit','out_for_delivery') and o.status not in ('confirmed','shipped')) then raise exception 'COD_EVENT_STATUS'; end if;
  if stage is not null and char_length(coalesce(trim(p_input->>'event_title'),''))<2 then raise exception 'COD_EVENT_STATUS'; end if;
  insert into public.cod_reviews(order_id,reviewed_by,callback_confirmed,address_confirmed,decision,note,order_snapshot)
  values(o.id,p_actor_id,callback,address_ok,decision,note_text,public.cod_order_snapshot(o))
  on conflict(order_id) do update set reviewed_by=excluded.reviewed_by,reviewed_at=now(),callback_confirmed=excluded.callback_confirmed,
    address_confirmed=excluded.address_confirmed,decision=excluded.decision,note=excluded.note,order_snapshot=excluded.order_snapshot;
  update public.orders set cod_verification_status=decision,cod_verification_method='phone_callback',
    cod_verified_at=case when decision in ('phone_verified','approved') then now() else null end,
    courier_name=nullif(trim(p_input->>'courier_name'),''),delivery_tracking_number=nullif(trim(p_input->>'tracking_number'),''),
    estimated_delivery_at=nullif(p_input->>'estimated_delivery_at','')::timestamptz,
    delivery_status_detail=coalesce(nullif(p_input->>'event_description',''),delivery_status_detail),
    delivery_last_event_at=case when stage is not null then now() else delivery_last_event_at end where id=o.id;
  if stage is not null then
    insert into public.delivery_events(order_id,stage,title,description,location_label,created_by)
    values(o.id,stage,p_input->>'event_title',p_input->>'event_description',p_input->>'event_location',p_actor_id);
  end if;
  insert into public.audit_log(actor_id,action,target_type,target_id,previous_data,new_data)
    values(p_actor_id,'order.cod.review','order',o.id::text,jsonb_build_object('verification_status',o.cod_verification_status),p_input);
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.cod_review_context(p_actor_id uuid,p_order_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.orders; result jsonb; r jsonb;
begin
  if not exists(select 1 from public.profiles where id=p_actor_id and role='admin') then raise exception 'Forbidden'; end if;
  select * into o from public.orders where id=p_order_id;
  if not found then raise exception 'Order not found'; end if;
  select jsonb_build_object('callback_confirmed',callback_confirmed,'address_confirmed',address_confirmed,'note',note,'reviewed_at',reviewed_at)
    into r from public.cod_reviews where order_id=o.id and order_snapshot=public.cod_order_snapshot(o);
  select jsonb_build_object('delivered',count(*) filter(where status='delivered'),
    'open',count(*) filter(where status in ('pending','confirmed','shipped')),
    'cancelled',count(*) filter(where status='cancelled'),'review',r) into result
    from public.orders where user_id=o.user_id and id<>o.id;
  return result;
end $$;

-- This list is managed by the sheet; custom customer lists are not touched.
insert into public.price_lists(name,description,is_active)
values('Sheet B2B (MMK)','Sheet-managed MMK prices. Verified businesses only; 3+ units of the same product.',true)
on conflict(name) do nothing;

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
    if price_value is not null and (minimum is null or minimum<3 or minimum>10000 or price_value<=0 or product_record.price<=0 or price_value>product_record.price) then raise exception 'Invalid wholesale price or minimum quantity'; end if;
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

revoke all on function public.review_cod_delivery(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.cod_review_context(uuid,uuid) from public,anon,authenticated;
revoke all on function public.sync_sheet_b2b(jsonb) from public,anon,authenticated;
grant execute on function public.review_cod_delivery(uuid,uuid,jsonb) to service_role;
grant execute on function public.cod_review_context(uuid,uuid) to service_role;
grant execute on function public.sync_sheet_b2b(jsonb) to service_role;
notify pgrst,'reload schema';
commit;
