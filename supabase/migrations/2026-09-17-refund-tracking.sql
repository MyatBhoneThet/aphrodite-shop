-- A refund tracker the customer can actually follow.
--
-- Request received → Under review → Item received → Refund approved → Money sent
--
-- The ladder in 2026-09-17-help-cases-and-item-returns.sql stopped at
-- `inspected` → `completed`, which hid the step customers ask about most:
-- the refund was authorised but the money has not moved yet. `refund_approved`
-- is that step, and the new columns carry the promised date plus a plain
-- explanation whenever it slips.
--
-- Run AFTER 2026-09-17-help-cases-and-item-returns.sql. Idempotent.

begin;

alter table public.return_requests
  -- What we agreed to pay back, and how it was actually sent.
  add column if not exists refund_amount integer
    check (refund_amount is null or refund_amount >= 0),
  add column if not exists refund_method text,
  add column if not exists refund_reference text,
  add column if not exists refund_approved_at timestamptz,
  add column if not exists refund_sent_at timestamptz,
  -- Shown to the customer as "expected by". Staff sets it; it is a promise,
  -- so `delay_reason` must explain any date that moves.
  add column if not exists expected_refund_at timestamptz,
  add column if not exists delay_reason text;

alter table public.return_requests
  drop constraint if exists return_requests_refund_method_check;
alter table public.return_requests
  add constraint return_requests_refund_method_check
  check (refund_method is null or refund_method in (
    'cash', 'bank_transfer', 'mobile_wallet', 'store_credit'
  ));

-- `refund_approved` sits between inspection and the money leaving.
alter table public.return_requests
  drop constraint if exists return_requests_status_check;
alter table public.return_requests
  add constraint return_requests_status_check
  check (status in (
    'requested', 'more_info_needed', 'approved', 'declined',
    'collected', 'inspected', 'refund_approved', 'completed', 'cancelled'
  ));

-- The partial index that keeps one live claim per line has to know about the
-- new in-flight state, or a second claim could be opened while a refund is
-- still being paid.
drop index if exists public.return_requests_one_open_per_item;
create unique index if not exists return_requests_one_open_per_item
  on public.return_requests(order_item_id)
  where status in (
    'requested', 'more_info_needed', 'approved', 'collected',
    'inspected', 'refund_approved'
  );

drop index if exists public.return_requests_open_idx;
create index if not exists return_requests_open_idx
  on public.return_requests(status, created_at desc)
  where status in (
    'requested', 'more_info_needed', 'approved', 'collected', 'refund_approved'
  );

-- Refunds that are past their promised date, for the admin inbox.
create index if not exists return_requests_expected_refund_idx
  on public.return_requests(expected_refund_at)
  where expected_refund_at is not null and refund_sent_at is null;

commit;

notify pgrst, 'reload schema';
