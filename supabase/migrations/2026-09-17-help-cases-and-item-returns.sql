-- One "Get help with this order" case, and returns that name a single item.
--
-- Two problems this fixes:
--
-- 1. A customer with a problem had to explain it from scratch in live chat,
--    and the administrator had to hunt for the order, the payment slips, the
--    delivery events and the photos separately. A help case ties all of that
--    to one order and one topic, and reuses the customer's existing support
--    conversation so nothing has to be repeated.
--
-- 2. `orders.return_request_status` describes the WHOLE order, so returning
--    one faulty mouse dragged the entire laptop bundle with it. A return
--    request now points at one `order_items` row and carries its own decision,
--    so several items of one order can be at different stages.
--
-- The older whole-order columns are untouched and the existing admin workflow
-- (schedule pickup / receive / refund) keeps working exactly as before.
--
-- Idempotent: safe to run more than once.

begin;

-- ---------------------------------------------------------------------------
-- 1. Help cases
-- ---------------------------------------------------------------------------

create table if not exists public.order_help_cases (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  topic text not null check (topic in (
    'payment', 'delivery', 'faulty_item', 'cancel_order', 'warranty'
  )),
  status text not null default 'open' check (status in (
    'open', 'waiting_customer', 'resolved', 'closed'
  )),
  -- What the customer typed when opening the case.
  summary text not null check (char_length(trim(summary)) between 5 and 1000),
  -- The customer's single support thread. The case posts its opening message
  -- there, so the conversation the admin already knows is the conversation
  -- attached to the case.
  conversation_id uuid references public.support_conversations(id) on delete set null,
  assigned_admin_id uuid references public.profiles(id) on delete set null,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists order_help_cases_order_idx
  on public.order_help_cases(order_id, created_at desc);
create index if not exists order_help_cases_customer_idx
  on public.order_help_cases(customer_id, created_at desc);
-- The admin inbox reads open cases newest-first.
create index if not exists order_help_cases_open_idx
  on public.order_help_cases(status, created_at desc)
  where status in ('open', 'waiting_customer');

-- ---------------------------------------------------------------------------
-- 2. Per-item return requests
-- ---------------------------------------------------------------------------

create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  -- The single line being returned. Deleting the line removes the request.
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  quantity integer not null default 1 check (quantity >= 1),
  reason_code text not null check (reason_code in (
    'defective', 'wrong_item', 'wrong_color', 'wrong_storage',
    'damaged_in_transit', 'other'
  )),
  description text not null
    check (char_length(trim(description)) between 10 and 1000),
  -- What the customer asked for. `resolution_granted` is what staff agreed to,
  -- which may differ (a repair where a replacement is not available).
  preferred_resolution text not null check (preferred_resolution in (
    'replacement', 'refund', 'repair'
  )),
  resolution_granted text check (resolution_granted is null or resolution_granted in (
    'replacement', 'refund', 'repair'
  )),
  collection_method text not null check (collection_method in (
    'courier_pickup', 'store_dropoff'
  )),
  pickup_address text,
  status text not null default 'requested' check (status in (
    'requested', 'more_info_needed', 'approved', 'declined',
    'collected', 'inspected', 'completed', 'cancelled'
  )),
  -- The customer confirmed they filmed the parcel before opening it. Required
  -- by the app for transit damage; stored for every request so a later dispute
  -- shows what was claimed at the time.
  unboxing_video_confirmed boolean not null default false,
  admin_decision_note text,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  -- A declined customer may ask for one more look; staff sees it as new again.
  review_requested_at timestamptz,
  review_request_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists return_requests_order_idx
  on public.return_requests(order_id, created_at desc);
create index if not exists return_requests_customer_idx
  on public.return_requests(customer_id, created_at desc);
create index if not exists return_requests_open_idx
  on public.return_requests(status, created_at desc)
  where status in ('requested', 'more_info_needed', 'approved', 'collected');

-- One open request per line: a second one is only allowed once the first is
-- finished, so staff never sees two live claims for the same item.
create unique index if not exists return_requests_one_open_per_item
  on public.return_requests(order_item_id)
  where status in (
    'requested', 'more_info_needed', 'approved', 'collected', 'inspected'
  );

-- ---------------------------------------------------------------------------
-- 3. Evidence can now belong to a case or a return request
-- ---------------------------------------------------------------------------

alter table public.return_evidence
  add column if not exists case_id uuid
    references public.order_help_cases(id) on delete cascade,
  add column if not exists return_request_id uuid
    references public.return_requests(id) on delete cascade;

create index if not exists return_evidence_case_idx
  on public.return_evidence(case_id, created_at asc)
  where case_id is not null;
create index if not exists return_evidence_request_idx
  on public.return_evidence(return_request_id, created_at asc)
  where return_request_id is not null;

-- `parcel_photo` is the sealed parcel before opening, which is what proves
-- transit damage alongside the unboxing video.
alter table public.return_evidence
  drop constraint if exists return_evidence_evidence_kind_check;
alter table public.return_evidence
  add constraint return_evidence_evidence_kind_check
  check (evidence_kind in (
    'product_photo', 'shipping_damage_photo', 'unboxing_video',
    'serial_photo', 'parcel_photo', 'other'
  ));

-- ---------------------------------------------------------------------------
-- 4. Keep updated_at honest
-- ---------------------------------------------------------------------------

drop trigger if exists set_order_help_cases_updated_at on public.order_help_cases;
create trigger set_order_help_cases_updated_at
before update on public.order_help_cases
for each row execute function public.set_updated_at();

drop trigger if exists set_return_requests_updated_at on public.return_requests;
create trigger set_return_requests_updated_at
before update on public.return_requests
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. RLS
--
-- Browsers get SELECT on their own rows only; every insert and decision goes
-- through an authenticated server route running as the service role.
-- ---------------------------------------------------------------------------

alter table public.order_help_cases enable row level security;
alter table public.return_requests enable row level security;

revoke all on table public.order_help_cases from anon, authenticated;
revoke all on table public.return_requests from anon, authenticated;
grant select on table public.order_help_cases to authenticated;
grant select on table public.return_requests to authenticated;
grant all on table public.order_help_cases to service_role;
grant all on table public.return_requests to service_role;

drop policy if exists "Customers read own help cases" on public.order_help_cases;
create policy "Customers read own help cases" on public.order_help_cases
  for select to authenticated
  using (customer_id = (select auth.uid()));

drop policy if exists "Admins read every help case" on public.order_help_cases;
create policy "Admins read every help case" on public.order_help_cases
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Customers read own return requests" on public.return_requests;
create policy "Customers read own return requests" on public.return_requests
  for select to authenticated
  using (customer_id = (select auth.uid()));

drop policy if exists "Admins read every return request" on public.return_requests;
create policy "Admins read every return request" on public.return_requests
  for select to authenticated
  using ((select public.is_admin()));

commit;

notify pgrst, 'reload schema';
