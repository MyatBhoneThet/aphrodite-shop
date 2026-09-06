-- Delivery tracking, consented checkout location, COD verification, and
-- private return evidence metadata.
--
-- Files themselves are stored in a PRIVATE Supabase Storage bucket named
-- `return-evidence`. Create that bucket in Storage before enabling uploads.

alter table public.orders
  add column if not exists cod_verification_status text not null default 'pending',
  add column if not exists cod_verification_method text,
  add column if not exists cod_verified_at timestamptz,
  add column if not exists delivery_latitude numeric(9, 6),
  add column if not exists delivery_longitude numeric(9, 6),
  add column if not exists delivery_accuracy_m integer,
  add column if not exists delivery_location_consent boolean not null default false,
  add column if not exists delivery_location_captured_at timestamptz,
  add column if not exists courier_name text,
  add column if not exists delivery_tracking_number text,
  add column if not exists estimated_delivery_at timestamptz,
  add column if not exists delivery_status_detail text,
  add column if not exists delivery_last_event_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_cod_verification_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_cod_verification_status_check
      check (cod_verification_status in (
        'pending', 'phone_verified', 'deposit_verified', 'approved', 'rejected'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_cod_verification_method_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_cod_verification_method_check
      check (
        cod_verification_method is null
        or cod_verification_method in ('phone_callback', 'cod_deposit', 'admin_review')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_delivery_coordinates_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_delivery_coordinates_check
      check (
        (delivery_latitude is null and delivery_longitude is null)
        or (
          delivery_latitude between -90 and 90
          and delivery_longitude between -180 and 180
          and delivery_location_consent = true
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_delivery_accuracy_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_delivery_accuracy_check
      check (delivery_accuracy_m is null or delivery_accuracy_m between 0 and 100000);
  end if;
end $$;

create table if not exists public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  stage text not null check (stage in (
    'order_placed', 'verification_pending', 'verified', 'packed',
    'handed_to_courier', 'in_transit', 'out_for_delivery',
    'delivered', 'delivery_failed'
  )),
  title text not null check (char_length(title) between 2 and 120),
  description text,
  location_label text,
  happened_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  visible_to_customer boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists delivery_events_order_time_idx
  on public.delivery_events(order_id, happened_at asc);

create table if not exists public.return_evidence (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  evidence_kind text not null check (evidence_kind in (
    'product_photo', 'shipping_damage_photo', 'unboxing_video', 'serial_photo', 'other'
  )),
  storage_path text,
  external_url text,
  file_name text,
  content_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 0 and 52428800),
  created_at timestamptz not null default now(),
  check (
    (storage_path is not null and external_url is null)
    or (storage_path is null and external_url is not null)
  )
);

create index if not exists return_evidence_order_time_idx
  on public.return_evidence(order_id, created_at asc);

alter table public.delivery_events enable row level security;
alter table public.return_evidence enable row level security;

revoke all on table public.delivery_events from anon, authenticated;
revoke all on table public.return_evidence from anon, authenticated;
grant select on table public.delivery_events to authenticated;
grant select on table public.return_evidence to authenticated;
grant all on table public.delivery_events to service_role;
grant all on table public.return_evidence to service_role;

drop policy if exists "Owners and admins read delivery events" on public.delivery_events;
create policy "Owners and admins read delivery events"
on public.delivery_events for select
to authenticated
using (
  exists (
    select 1 from public.orders
    where orders.id = delivery_events.order_id
      and (
        orders.user_id = (select auth.uid())
        or exists (
          select 1 from public.profiles
          where profiles.id = (select auth.uid()) and profiles.role = 'admin'
        )
      )
  )
);

drop policy if exists "Owners and admins read return evidence" on public.return_evidence;
create policy "Owners and admins read return evidence"
on public.return_evidence for select
to authenticated
using (
  exists (
    select 1 from public.orders
    where orders.id = return_evidence.order_id
      and (
        orders.user_id = (select auth.uid())
        or exists (
          select 1 from public.profiles
          where profiles.id = (select auth.uid()) and profiles.role = 'admin'
        )
      )
  )
);

-- Existing authenticated-order policies continue to protect the new order
-- columns. Browser users receive SELECT only for evidence/event rows; all
-- inserts and mutations go through authenticated server routes and service role.
