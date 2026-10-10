-- Customer notifications: the in-app bell list and phone (web push) subscriptions.
-- Reached only through the server's account routes (service role).

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 60),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 500),
  link text check (link is null or (char_length(link) <= 300 and link like '/%')),
  -- The same event is only announced once (e.g. "delivered" saved twice).
  dedupe_key text check (dedupe_key is null or char_length(dedupe_key) <= 200),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_time_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;
create unique index if not exists notifications_dedupe_idx
  on public.notifications (user_id, dedupe_key) where dedupe_key is not null;

alter table public.notifications enable row level security;
revoke all on table public.notifications from anon, authenticated;
grant select, insert, update, delete on table public.notifications to service_role;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null,
  auth text not null,
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to service_role;

notify pgrst, 'reload schema';
