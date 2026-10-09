-- Stable identity and safe image defaults for the production Google Sheet
-- importer. A normal UNIQUE index still permits multiple NULL source keys for
-- products created manually in the admin panel.
alter table public.products
  add column if not exists source_key text,
  add column if not exists source_sheet text;

alter table public.products
  alter column image set default '/products/production-placeholder.svg';

create unique index if not exists products_source_key_uidx
  on public.products (source_key);

-- Earlier mock-sheet imports supplied explicit integer IDs, which does not
-- advance a PostgreSQL serial sequence. Move the sequence past existing rows
-- before production inserts begin using generated IDs.
select setval(
  pg_get_serial_sequence('public.products', 'id'),
  coalesce((select max(id) from public.products), 0) + 1,
  false
);
