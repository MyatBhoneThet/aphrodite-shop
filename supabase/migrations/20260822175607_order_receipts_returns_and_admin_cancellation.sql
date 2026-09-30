-- Digital receipts, administrator cancellation, and a staged return workflow.
-- Apply this file after supabase/schema.sql on a new database, or apply it
-- directly to an existing database after all earlier migrations.

alter table public.orders
  add column if not exists confirmed_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists receipt_number text,
  add column if not exists receipt_sent_at timestamptz,
  add column if not exists receipt_email_status text not null default 'not_sent',
  add column if not exists receipt_email_error text,
  add column if not exists cancellation_source text,
  add column if not exists cancellation_reason_code text,
  add column if not exists return_reason_code text,
  add column if not exists return_pickup_method text,
  add column if not exists return_pickup_address text,
  add column if not exists return_pickup_scheduled_for timestamptz,
  add column if not exists return_pickup_instructions text,
  add column if not exists return_pickup_tracking_number text,
  add column if not exists return_received_at timestamptz,
  add column if not exists return_inspection_notes text,
  add column if not exists return_restock_approved boolean,
  add column if not exists refund_method text,
  add column if not exists refund_reference text,
  add column if not exists refund_amount integer,
  add column if not exists refund_completed_at timestamptz;

-- Backfill lifecycle timestamps for orders completed before this migration.
update public.orders
set confirmed_at = coalesce(confirmed_at, updated_at)
where status in ('confirmed', 'shipped', 'delivered', 'returned')
  and confirmed_at is null;

update public.orders
set delivered_at = coalesce(delivered_at, updated_at)
where status in ('delivered', 'returned')
  and delivered_at is null;

alter table public.orders
  drop constraint if exists orders_return_request_status_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_return_request_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_return_request_status_check
      check (return_request_status in (
        'none', 'requested', 'approved', 'pickup_scheduled',
        'received', 'refunded', 'rejected'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_receipt_email_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_receipt_email_status_check
      check (receipt_email_status in ('not_sent', 'sent', 'not_configured', 'failed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_cancellation_source_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_cancellation_source_check
      check (cancellation_source is null or cancellation_source in ('customer', 'admin'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_return_reason_code_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_return_reason_code_check
      check (return_reason_code is null or return_reason_code in (
        'defective', 'wrong_item', 'wrong_color', 'wrong_storage',
        'damaged_in_transit', 'other'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_return_pickup_method_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_return_pickup_method_check
      check (return_pickup_method is null or return_pickup_method in (
        'courier_pickup', 'store_dropoff'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_refund_method_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_refund_method_check
      check (refund_method is null or refund_method in (
        'cash', 'bank_transfer', 'mobile_wallet', 'store_credit'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_refund_amount_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_refund_amount_check
      check (
        refund_amount is null
        or (refund_amount >= 0 and refund_amount <= total_amount)
      );
  end if;
end $$;

create unique index if not exists orders_receipt_number_uidx
  on public.orders (receipt_number)
  where receipt_number is not null;

create index if not exists orders_active_returns_idx
  on public.orders (return_request_status, return_requested_at desc)
  where return_request_status in (
    'requested', 'approved', 'pickup_scheduled', 'received'
  );

-- Customers request cancellation or a full-order return. The service-role
-- caller has already authenticated the user; the function still verifies
-- ownership and locks the order to prevent concurrent lifecycle actions.
drop function if exists public.request_order_action(uuid, uuid, text, text);
drop function if exists public.request_order_action(uuid, uuid, text, text, text, text, text);

create function public.request_order_action(
  p_user_id uuid,
  p_order_id uuid,
  p_request_type text,
  p_reason text,
  p_reason_code text,
  p_pickup_method text,
  p_pickup_address text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order
  from public.orders
  where id = p_order_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'INVALID_REQUEST_REASON' using errcode = 'P0001';
  end if;

  if p_request_type = 'cancellation' then
    if v_order.status not in ('pending', 'confirmed') then
      raise exception 'CANCELLATION_NOT_ALLOWED' using errcode = 'P0001';
    end if;
    if v_order.cancellation_request_status = 'requested' then
      raise exception 'REQUEST_ALREADY_PENDING' using errcode = 'P0001';
    end if;

    update public.orders set
      cancellation_request_status = 'requested',
      cancellation_source = 'customer',
      cancellation_reason_code = coalesce(nullif(trim(p_reason_code), ''), 'customer_request'),
      cancellation_reason = trim(p_reason),
      cancellation_requested_at = now(),
      cancellation_resolved_at = null,
      admin_order_note = null
    where id = p_order_id;

  elsif p_request_type = 'return' then
    if v_order.status <> 'delivered' or v_order.delivered_at is null then
      raise exception 'RETURN_NOT_ALLOWED' using errcode = 'P0001';
    end if;
    if now() > v_order.delivered_at + interval '7 days' then
      raise exception 'RETURN_WINDOW_EXPIRED' using errcode = 'P0001';
    end if;
    if v_order.return_request_status in (
      'requested', 'approved', 'pickup_scheduled', 'received', 'refunded'
    ) then
      raise exception 'REQUEST_ALREADY_PENDING' using errcode = 'P0001';
    end if;
    if p_reason_code not in (
      'defective', 'wrong_item', 'wrong_color', 'wrong_storage',
      'damaged_in_transit', 'other'
    ) then
      raise exception 'INVALID_RETURN_REASON' using errcode = 'P0001';
    end if;
    if p_pickup_method not in ('courier_pickup', 'store_dropoff') then
      raise exception 'INVALID_PICKUP_METHOD' using errcode = 'P0001';
    end if;
    if p_pickup_method = 'courier_pickup'
       and length(trim(coalesce(p_pickup_address, ''))) < 5 then
      raise exception 'PICKUP_ADDRESS_REQUIRED' using errcode = 'P0001';
    end if;

    update public.orders set
      return_request_status = 'requested',
      return_reason_code = p_reason_code,
      return_reason = trim(p_reason),
      return_pickup_method = p_pickup_method,
      return_pickup_address = nullif(trim(coalesce(p_pickup_address, '')), ''),
      return_requested_at = now(),
      return_resolved_at = null,
      return_pickup_scheduled_for = null,
      return_pickup_instructions = null,
      return_pickup_tracking_number = null,
      return_received_at = null,
      return_inspection_notes = null,
      return_restock_approved = null,
      refund_method = null,
      refund_reference = null,
      refund_amount = null,
      refund_completed_at = null,
      admin_order_note = null
    where id = p_order_id;
  else
    raise exception 'INVALID_REQUEST_TYPE' using errcode = 'P0001';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Approval starts the pickup process. Inventory and refund status are not
-- changed until staff records receipt/inspection and then completes refund.
create or replace function public.resolve_order_action(
  p_actor_id uuid,
  p_order_id uuid,
  p_request_type text,
  p_decision text,
  p_admin_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not exists (
    select 1 from public.profiles where id = p_actor_id and role = 'admin'
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'INVALID_DECISION' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_request_type = 'cancellation' then
    if v_order.cancellation_request_status <> 'requested' then
      raise exception 'REQUEST_NOT_PENDING' using errcode = 'P0001';
    end if;
    if p_decision = 'approve' then
      if v_order.status not in ('pending', 'confirmed') then
        raise exception 'CANCELLATION_NOT_ALLOWED' using errcode = 'P0001';
      end if;

      update public.products as product
      set stock_quantity = product.stock_quantity + items.quantity
      from public.order_items as items
      where items.order_id = p_order_id and product.id = items.product_id;

      update public.orders set
        status = 'cancelled',
        cancellation_request_status = 'approved',
        cancellation_source = 'customer',
        cancellation_resolved_at = now(),
        admin_order_note = nullif(trim(coalesce(p_admin_note, '')), '')
      where id = p_order_id;
    else
      update public.orders set
        cancellation_request_status = 'rejected',
        cancellation_resolved_at = now(),
        admin_order_note = nullif(trim(coalesce(p_admin_note, '')), '')
      where id = p_order_id;
    end if;

  elsif p_request_type = 'return' then
    if v_order.return_request_status <> 'requested' then
      raise exception 'REQUEST_NOT_PENDING' using errcode = 'P0001';
    end if;
    if p_decision = 'approve' then
      if v_order.status <> 'delivered' then
        raise exception 'RETURN_NOT_ALLOWED' using errcode = 'P0001';
      end if;
      update public.orders set
        return_request_status = 'approved',
        admin_order_note = nullif(trim(coalesce(p_admin_note, '')), '')
      where id = p_order_id;
    else
      update public.orders set
        return_request_status = 'rejected',
        return_resolved_at = now(),
        admin_order_note = nullif(trim(coalesce(p_admin_note, '')), '')
      where id = p_order_id;
    end if;
  else
    raise exception 'INVALID_REQUEST_TYPE' using errcode = 'P0001';
  end if;

  insert into public.audit_log (
    actor_id, action, target_type, target_id, previous_data, new_data
  ) values (
    p_actor_id,
    'order.' || p_request_type || '.' || p_decision,
    'order',
    p_order_id::text,
    jsonb_build_object(
      'status', v_order.status,
      'cancellation_request_status', v_order.cancellation_request_status,
      'return_request_status', v_order.return_request_status
    ),
    jsonb_build_object('decision', p_decision, 'admin_note', p_admin_note)
  );

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_cancel_order(
  p_actor_id uuid,
  p_order_id uuid,
  p_reason_code text,
  p_reason text,
  p_admin_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not exists (
    select 1 from public.profiles where id = p_actor_id and role = 'admin'
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_order.status not in ('pending', 'confirmed') then
    raise exception 'ADMIN_CANCELLATION_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'INVALID_REQUEST_REASON' using errcode = 'P0001';
  end if;

  update public.products as product
  set stock_quantity = product.stock_quantity + items.quantity
  from public.order_items as items
  where items.order_id = p_order_id and product.id = items.product_id;

  update public.orders set
    status = 'cancelled',
    cancellation_request_status = 'approved',
    cancellation_source = 'admin',
    cancellation_reason_code = coalesce(nullif(trim(p_reason_code), ''), 'other'),
    cancellation_reason = trim(p_reason),
    cancellation_requested_at = coalesce(cancellation_requested_at, now()),
    cancellation_resolved_at = now(),
    admin_order_note = nullif(trim(coalesce(p_admin_note, '')), '')
  where id = p_order_id;

  insert into public.audit_log (
    actor_id, action, target_type, target_id, previous_data, new_data
  ) values (
    p_actor_id,
    'order.admin_cancel',
    'order',
    p_order_id::text,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object(
      'status', 'cancelled',
      'reason_code', p_reason_code,
      'reason', p_reason,
      'admin_note', p_admin_note
    )
  );

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.advance_return_workflow(
  p_actor_id uuid,
  p_order_id uuid,
  p_action text,
  p_scheduled_for timestamptz,
  p_instructions text,
  p_tracking_number text,
  p_inspection_notes text,
  p_restock_approved boolean,
  p_refund_method text,
  p_refund_reference text,
  p_refund_amount integer,
  p_admin_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not exists (
    select 1 from public.profiles where id = p_actor_id and role = 'admin'
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_action = 'schedule_pickup' then
    if v_order.return_request_status <> 'approved' then
      raise exception 'RETURN_NOT_APPROVED' using errcode = 'P0001';
    end if;
    if p_scheduled_for is null then
      raise exception 'PICKUP_DATE_REQUIRED' using errcode = 'P0001';
    end if;

    update public.orders set
      return_request_status = 'pickup_scheduled',
      return_pickup_scheduled_for = p_scheduled_for,
      return_pickup_instructions = nullif(trim(coalesce(p_instructions, '')), ''),
      return_pickup_tracking_number = nullif(trim(coalesce(p_tracking_number, '')), ''),
      admin_order_note = coalesce(nullif(trim(coalesce(p_admin_note, '')), ''), admin_order_note)
    where id = p_order_id;

  elsif p_action = 'mark_received' then
    if v_order.return_request_status not in ('approved', 'pickup_scheduled') then
      raise exception 'RETURN_NOT_READY_FOR_RECEIPT' using errcode = 'P0001';
    end if;
    if p_restock_approved is null then
      raise exception 'INSPECTION_DECISION_REQUIRED' using errcode = 'P0001';
    end if;

    if p_restock_approved then
      update public.products as product
      set stock_quantity = product.stock_quantity + items.quantity
      from public.order_items as items
      where items.order_id = p_order_id and product.id = items.product_id;
    end if;

    update public.orders set
      return_request_status = 'received',
      return_received_at = now(),
      return_inspection_notes = nullif(trim(coalesce(p_inspection_notes, '')), ''),
      return_restock_approved = p_restock_approved,
      admin_order_note = coalesce(nullif(trim(coalesce(p_admin_note, '')), ''), admin_order_note)
    where id = p_order_id;

  elsif p_action = 'complete_refund' then
    if v_order.return_request_status <> 'received' then
      raise exception 'RETURN_NOT_RECEIVED' using errcode = 'P0001';
    end if;
    if p_refund_method not in ('cash', 'bank_transfer', 'mobile_wallet', 'store_credit') then
      raise exception 'INVALID_REFUND_METHOD' using errcode = 'P0001';
    end if;
    if p_refund_amount is null or p_refund_amount < 0 or p_refund_amount > v_order.total_amount then
      raise exception 'INVALID_REFUND_AMOUNT' using errcode = 'P0001';
    end if;

    update public.orders set
      status = 'returned',
      payment_status = 'refunded',
      return_request_status = 'refunded',
      return_resolved_at = now(),
      refund_method = p_refund_method,
      refund_reference = nullif(trim(coalesce(p_refund_reference, '')), ''),
      refund_amount = p_refund_amount,
      refund_completed_at = now(),
      admin_order_note = coalesce(nullif(trim(coalesce(p_admin_note, '')), ''), admin_order_note)
    where id = p_order_id;
  else
    raise exception 'INVALID_RETURN_ACTION' using errcode = 'P0001';
  end if;

  insert into public.audit_log (
    actor_id, action, target_type, target_id, previous_data, new_data
  ) values (
    p_actor_id,
    'order.return.' || p_action,
    'order',
    p_order_id::text,
    jsonb_build_object('return_request_status', v_order.return_request_status),
    jsonb_build_object(
      'action', p_action,
      'scheduled_for', p_scheduled_for,
      'restock_approved', p_restock_approved,
      'refund_method', p_refund_method,
      'refund_amount', p_refund_amount
    )
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.request_order_action(
  uuid, uuid, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.request_order_action(
  uuid, uuid, text, text, text, text, text
) to service_role;

revoke execute on function public.resolve_order_action(
  uuid, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.resolve_order_action(
  uuid, uuid, text, text, text
) to service_role;

revoke execute on function public.admin_cancel_order(
  uuid, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.admin_cancel_order(
  uuid, uuid, text, text, text
) to service_role;

revoke execute on function public.advance_return_workflow(
  uuid, uuid, text, timestamptz, text, text, text, boolean,
  text, text, integer, text
) from public, anon, authenticated;
grant execute on function public.advance_return_workflow(
  uuid, uuid, text, timestamptz, text, text, text, boolean,
  text, text, integer, text
) to service_role;
