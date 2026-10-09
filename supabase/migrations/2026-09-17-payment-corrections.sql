-- Payment corrections: the admin can ask a customer to fix a payment on the
-- SAME order instead of rejecting it outright, and the customer is shown the
-- exact amount still owed.
--
-- Why a new verification state rather than reusing 'rejected': a rejection
-- tells the customer to start again, which is wrong when 300,000 of 500,000
-- actually arrived. 'correction_requested' keeps the money already received on
-- the record and asks only for the difference.
--
-- Idempotent: safe to run more than once.

alter table public.orders
  -- What actually landed in the shop's account, in kyat. Null means "not
  -- counted yet" and is deliberately different from 0 ("nothing arrived").
  add column if not exists payment_amount_received bigint,
  add column if not exists payment_correction_reason text,
  add column if not exists payment_correction_requested_at timestamptz;

-- 'correction_requested' joins the existing states. Fulfilment stays blocked
-- for anything that is not 'verified' (see patchOrderStatus), so an order
-- awaiting a correction cannot be confirmed or shipped.
alter table public.orders drop constraint if exists orders_payment_verification_check;
alter table public.orders add constraint orders_payment_verification_check
  check (payment_verification_status in (
    'not_required', 'pending', 'verified', 'rejected', 'correction_requested'
  ));

alter table public.orders drop constraint if exists orders_payment_correction_reason_check;
alter table public.orders add constraint orders_payment_correction_reason_check
  check (payment_correction_reason is null or payment_correction_reason in (
    'short_payment', 'overpaid', 'unclear_slip', 'wrong_account', 'other'
  ));

alter table public.orders drop constraint if exists orders_payment_amount_received_check;
alter table public.orders add constraint orders_payment_amount_received_check
  check (payment_amount_received is null or payment_amount_received >= 0);

notify pgrst, 'reload schema';
