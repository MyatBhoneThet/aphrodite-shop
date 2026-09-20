-- Private customer-to-admin live support chat.
-- Apply after 2026-07-28-cod-order-lifecycle.sql.

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null
    references public.profiles(id) on delete cascade,
  assigned_admin_id uuid
    references public.profiles(id) on delete set null,
  status text not null default 'open'
    check (status in ('open', 'resolved')),
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  last_sender_role text
    check (last_sender_role is null or last_sender_role in ('customer', 'admin')),
  customer_last_read_at timestamptz,
  admin_last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id)
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.support_conversations(id) on delete cascade,
  sender_id uuid not null
    references public.profiles(id) on delete restrict,
  sender_role text not null
    check (sender_role in ('customer', 'admin')),
  body text not null
    check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists support_conversations_last_message_idx
  on public.support_conversations (last_message_at desc);
create index if not exists support_conversations_status_idx
  on public.support_conversations (status, last_message_at desc);
create index if not exists support_messages_conversation_idx
  on public.support_messages (conversation_id, created_at asc);

drop trigger if exists set_support_conversations_updated_at
  on public.support_conversations;
create trigger set_support_conversations_updated_at
before update on public.support_conversations
for each row execute function public.set_updated_at();

create or replace function public.sync_support_conversation_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_conversations
  set
    status = 'open',
    last_message_at = new.created_at,
    last_message_preview = left(new.body, 160),
    last_sender_role = new.sender_role
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists sync_support_conversation_after_message
  on public.support_messages;
create trigger sync_support_conversation_after_message
after insert on public.support_messages
for each row execute function public.sync_support_conversation_from_message();

-- Chat data is never exposed directly to browsers. Server routes authenticate
-- the account, enforce ownership/admin access, and use the service role.
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

revoke all on table public.support_conversations
  from public, anon, authenticated;
revoke all on table public.support_messages
  from public, anon, authenticated;
grant select, insert, update, delete on table public.support_conversations
  to service_role;
grant select, insert, update, delete on table public.support_messages
  to service_role;

revoke execute on function public.sync_support_conversation_from_message()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
