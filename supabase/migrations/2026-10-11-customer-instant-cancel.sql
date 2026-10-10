-- A customer can cancel an order straight away while the shop has not checked
-- it yet (status 'pending') and no money can have changed hands. Anything
-- later still goes through the existing cancellation request.
--
-- One transaction: stock goes back and the order is closed together, exactly as
-- admin_cancel_order does. Only the server (service role) can call it.

create or replace function public.customer_cancel_order(
  p_user_id uuid,
  p_order_id uuid,
  p_reason text
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

  -- Not the instant path: already checked, closed, with a request open, or
  -- possibly paid. The server falls back to a normal cancellation request.
  if v_order.status <> 'pending'
     or v_order.cancellation_request_status in ('requested', 'approved') then
    raise exception 'CANCEL_NOT_INSTANT' using errcode = 'P0001';
  end if;
  if v_order.payment_method in ('bank_transfer', 'mmqr') then
    if coalesce(v_order.payment_verification_status, 'pending') = 'verified'
       or exists (select 1 from public.payment_slips where order_id = p_order_id) then
      raise exception 'CANCEL_NOT_INSTANT' using errcode = 'P0001';
    end if;
  end if;

  update public.products as product
  set stock_quantity = product.stock_quantity + items.quantity
  from public.order_items as items
  where items.order_id = p_order_id and product.id = items.product_id;

  update public.orders set
    status = 'cancelled',
    cancellation_request_status = 'approved',
    cancellation_source = 'customer',
    cancellation_reason_code = 'customer_request',
    cancellation_reason = trim(p_reason),
    cancellation_requested_at = now(),
    cancellation_resolved_at = now()
  where id = p_order_id;

  insert into public.audit_log (
    actor_id, action, target_type, target_id, previous_data, new_data
  ) values (
    p_user_id,
    'order.cancel.self',
    'order',
    p_order_id::text,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'cancelled', 'reason', trim(p_reason))
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.customer_cancel_order(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.customer_cancel_order(uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
