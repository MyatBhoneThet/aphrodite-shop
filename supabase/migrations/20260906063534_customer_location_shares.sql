begin;

create table if not exists public.customer_location_shares (
  user_id uuid primary key references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision not null check (accuracy_m >= 0 and accuracy_m <= 20000000),
  captured_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  consent_version text not null check (consent_version = 'store-review-v1'),
  check (expires_at > captured_at and expires_at <= captured_at + interval '30 days')
);

alter table public.customer_location_shares enable row level security;
revoke all on table public.customer_location_shares from public, anon, authenticated;
grant select, insert, update, delete on table public.customer_location_shares to service_role;
create index if not exists customer_location_shares_expiry_idx
  on public.customer_location_shares (expires_at);

comment on table public.customer_location_shares is
  'Optional, one-time customer location shared for order review; expires after 30 days.';

do $migration$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'aphrodite-expired-location-shares',
      '0 * * * *',
      'delete from public.customer_location_shares where expires_at <= now()'
    );
  end if;
end
$migration$;

notify pgrst, 'reload schema';
commit;
