create table if not exists public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists customer_notes_customer_idx
  on public.customer_notes (customer_id, created_at desc);

-- Staff-only data: reachable only through the admin API routes (service role).
alter table public.customer_notes enable row level security;
revoke all on public.customer_notes from anon, authenticated;
grant select, insert, update, delete on table public.customer_notes to service_role;

notify pgrst, 'reload schema';
