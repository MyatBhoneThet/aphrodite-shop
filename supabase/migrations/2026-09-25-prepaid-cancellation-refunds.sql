-- Safe cancellation refunds for prepaid orders.
--
-- COD cancellations close immediately because no money was collected.
-- Bank-transfer/MMQR cancellations must be reviewed first. Rejected/unpaid
-- transfers close normally; verified/collected payments then wait for the
-- customer to provide a refund destination. The application records the
-- actual transfer separately; cancelling never claims money was sent.

alter table public.orders
  add column if not exists cancellation_refund_status text not null default 'none',
  add column if not exists cancellation_refund_bank_name text,
  add column if not exists cancellation_refund_account_name text,
  add column if not exists cancellation_refund_account_number text,
  add column if not exists cancellation_refund_details_submitted_at timestamptz;

alter table public.orders drop constraint if exists orders_cancellation_refund_status_check;
alter table public.orders add constraint orders_cancellation_refund_status_check
  check (cancellation_refund_status in ('none', 'details_required', 'pending', 'sent'));

alter table public.orders drop constraint if exists orders_cancellation_refund_account_check;
alter table public.orders add constraint orders_cancellation_refund_account_check check (
  cancellation_refund_status in ('none', 'details_required')
  or (
    char_length(trim(coalesce(cancellation_refund_bank_name, ''))) >= 2 and
    char_length(trim(coalesce(cancellation_refund_account_name, ''))) >= 2 and
    char_length(trim(coalesce(cancellation_refund_account_number, ''))) >= 5
  )
);

-- Recover verified prepaid cancellations made immediately before this
-- migration was installed, so those customers also receive the refund form.
update public.orders
set
  cancellation_refund_status = 'details_required',
  refund_amount = total_amount
where status = 'cancelled'
  and payment_method in ('bank_transfer', 'mmqr')
  and payment_status = 'collected'
  and payment_verification_status = 'verified'
  and cancellation_refund_status = 'none'
  and refund_completed_at is null;

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
  v_prepaid boolean;
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

  v_prepaid := v_order.payment_method in ('bank_transfer', 'mmqr');
  -- A transfer must be reviewed before cancellation. A rejected/unpaid
  -- transfer can be cancelled normally; only verified/collected money enters
  -- the customer-refund workflow.
  if v_prepaid and v_order.payment_verification_status not in ('verified', 'rejected') then
    raise exception 'PAYMENT_REVIEW_REQUIRED' using errcode = 'P0001';
  end if;
  if v_prepaid and v_order.payment_verification_status = 'verified'
    and v_order.payment_status <> 'collected' then
    raise exception 'PAYMENT_REVIEW_REQUIRED' using errcode = 'P0001';
  end if;

  v_prepaid := v_prepaid
    and v_order.payment_verification_status = 'verified'
    and v_order.payment_status = 'collected';

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
    cancellation_refund_status = case when v_prepaid then 'details_required' else 'none' end,
    refund_amount = case when v_prepaid then v_order.total_amount else null end,
    refund_method = null,
    refund_reference = null,
    refund_completed_at = null,
    cancellation_refund_bank_name = null,
    cancellation_refund_account_name = null,
    cancellation_refund_account_number = null,
    cancellation_refund_details_submitted_at = null,
    admin_order_note = nullif(trim(coalesce(p_admin_note, '')), '')
  where id = p_order_id;

  insert into public.audit_log (
    actor_id, action, target_type, target_id, previous_data, new_data
  ) values (
    p_actor_id,
    'order.admin_cancel',
    'order',
    p_order_id::text,
    jsonb_build_object(
      'status', v_order.status,
      'payment_status', v_order.payment_status,
      'payment_verification_status', v_order.payment_verification_status
    ),
    jsonb_build_object(
      'status', 'cancelled',
      'reason_code', p_reason_code,
      'reason', p_reason,
      'refund_status', case when v_prepaid then 'details_required' else 'none' end,
      'admin_note', p_admin_note
    )
  );

  return jsonb_build_object(
    'ok', true,
    'refund_status', case when v_prepaid then 'details_required' else 'none' end
  );
end;
$$;

revoke execute on function public.admin_cancel_order(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_cancel_order(uuid, uuid, text, text, text)
  to service_role;

notify pgrst, 'reload schema';
