-- One admin queue for everything that needs attention.
--
-- Two ideas, deliberately kept apart:
--
--   * WHICH LANE a case sits in is DERIVED from its own state (see
--     app/lib/work-queue.ts) and is never stored. A lane column would drift
--     the moment a payment was verified or a refund was sent somewhere else.
--
--   * WHO OWNS IT, what the next action is, and when it is due cannot be
--     derived from anything, so those are stored here — one row per case,
--     whatever kind of case it is.
--
-- `staff_notes` is the internal side of a case. It has NO customer-readable
-- policy of any kind: customer-facing words belong in support_messages, and
-- these notes must never appear there.
--
-- Run AFTER 2026-09-17-refund-tracking.sql. Idempotent.

begin;

-- ---------------------------------------------------------------------------
-- 1. Ownership, next action, due date
-- ---------------------------------------------------------------------------

create table if not exists public.work_queue_items (
  id uuid primary key default gen_random_uuid(),
  -- Which kind of thing needs attention. An order can need a payment check,
  -- a help case can need an answer, a return can need inspecting.
  subject_type text not null check (subject_type in (
    'order', 'help_case', 'return_request'
  )),
  subject_id uuid not null,
  owner_id uuid references public.profiles(id) on delete set null,
  next_action text check (next_action is null or char_length(next_action) <= 300),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One assignment per case, so assigning is an upsert and two admins cannot
  -- end up owning different copies of the same work.
  unique (subject_type, subject_id)
);

create index if not exists work_queue_items_owner_idx
  on public.work_queue_items(owner_id, due_at);
-- Overdue lookups: only rows that actually carry a deadline.
create index if not exists work_queue_items_due_idx
  on public.work_queue_items(due_at)
  where due_at is not null;

-- ---------------------------------------------------------------------------
-- 2. Internal staff notes (never shown to the customer)
-- ---------------------------------------------------------------------------

create table if not exists public.staff_notes (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in (
    'order', 'help_case', 'return_request'
  )),
  subject_id uuid not null,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists staff_notes_subject_idx
  on public.staff_notes(subject_type, subject_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. updated_at
-- ---------------------------------------------------------------------------

drop trigger if exists set_work_queue_items_updated_at on public.work_queue_items;
create trigger set_work_queue_items_updated_at
before update on public.work_queue_items
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS — administrators only, for BOTH tables
--
-- There is intentionally no customer policy. A customer reading staff notes
-- would defeat the whole point of keeping them off the support thread.
-- ---------------------------------------------------------------------------

alter table public.work_queue_items enable row level security;
alter table public.staff_notes enable row level security;

revoke all on table public.work_queue_items from anon, authenticated;
revoke all on table public.staff_notes from anon, authenticated;
grant select on table public.work_queue_items to authenticated;
grant select on table public.staff_notes to authenticated;
grant all on table public.work_queue_items to service_role;
grant all on table public.staff_notes to service_role;

drop policy if exists "Admins read the work queue" on public.work_queue_items;
create policy "Admins read the work queue" on public.work_queue_items
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins read staff notes" on public.staff_notes;
create policy "Admins read staff notes" on public.staff_notes
  for select to authenticated
  using ((select public.is_admin()));

commit;

notify pgrst, 'reload schema';
