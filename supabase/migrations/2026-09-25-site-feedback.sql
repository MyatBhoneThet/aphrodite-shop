create table if not exists public.site_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, order_id)
);

create index if not exists site_feedback_created_idx on public.site_feedback (created_at desc);

alter table public.site_feedback enable row level security;
revoke all on public.site_feedback from anon, authenticated;
grant select, insert, update, delete on table public.site_feedback to service_role;

notify pgrst, 'reload schema';
