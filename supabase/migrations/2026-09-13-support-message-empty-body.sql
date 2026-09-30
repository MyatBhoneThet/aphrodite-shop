-- =============================================================================
-- Allow photo-only live-chat messages
-- Incremental migration for an EXISTING deployed database.
--
-- Safe to rerun: every statement is guarded. Run it inside the Supabase SQL
-- editor or via `psql < this file`. Runs in a single transaction.
--
-- Why this is needed
--   The original table (2026-07-28-live-support-chat.sql) declared:
--       body text not null check (char_length(trim(body)) between 1 and 1000)
--   Postgres auto-named that check `support_messages_body_check`. The "between
--   1 and ..." lower bound forbids an EMPTY body, so a customer who sends only
--   a photo (body = '') is rejected with:
--       new row for relation "support_messages" violates check constraint
--       "support_messages_body_check"
--   The previous migration added `support_messages_not_empty`, which already
--   expresses the real rule -- a message must carry text OR a photo OR a
--   product -- but BOTH constraints have to pass, so the older, stricter one
--   still blocked photo-only messages.
--
--   This migration replaces the old check with a length-only cap and leaves
--   `support_messages_not_empty` as the single source of truth. The 1000
--   character limit is preserved exactly.
-- =============================================================================

begin;

alter table public.support_messages
  drop constraint if exists support_messages_body_check;

-- Keep the upper bound: a message body still cannot exceed 1000 characters.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'support_messages_body_length'
  ) then
    alter table public.support_messages
      add constraint support_messages_body_length
      check (char_length(trim(body)) <= 1000);
  end if;
end $$;

-- Safety net: recreate the composite rule if the previous migration was only
-- partly applied, so an entirely empty message is still impossible.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'support_messages_not_empty'
  ) then
    alter table public.support_messages
      add constraint support_messages_not_empty
      check (
        length(coalesce(body, '')) > 0
        or attachment_path is not null
        or product_id is not null
      );
  end if;
end $$;

commit;
