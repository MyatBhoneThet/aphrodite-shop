-- Admin-managed homepage carousel advertisements use a JSON manifest inside
-- this public bucket. The server creates the bucket automatically as well, so
-- local development does not depend on running this migration first.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'homepage-ads',
  'homepage-ads',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'application/json']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
