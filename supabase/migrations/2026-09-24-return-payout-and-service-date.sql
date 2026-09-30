-- Customer payout details for refunds, and a preferred appointment date for
-- replacement/repair requests. Access remains covered by return_requests RLS.

begin;

alter table public.return_requests
  add column if not exists refund_bank_name text,
  add column if not exists refund_account_name text,
  add column if not exists refund_account_number text,
  add column if not exists preferred_service_at timestamptz;

alter table public.return_requests
  drop constraint if exists return_requests_refund_account_check;
alter table public.return_requests
  add constraint return_requests_refund_account_check check (
    preferred_resolution <> 'refund' or (
      char_length(trim(coalesce(refund_bank_name, ''))) >= 2 and
      char_length(trim(coalesce(refund_account_name, ''))) >= 2 and
      char_length(trim(coalesce(refund_account_number, ''))) >= 5
    )
  ) not valid;

alter table public.return_requests
  drop constraint if exists return_requests_service_date_check;
alter table public.return_requests
  add constraint return_requests_service_date_check check (
    preferred_resolution = 'refund' or preferred_service_at is not null
  ) not valid;

commit;

notify pgrst, 'reload schema';
