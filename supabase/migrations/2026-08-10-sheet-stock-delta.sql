-- Inventory reconciliation between the production workbook and the storefront.
--
-- Before this, every sheet sync overwrote products.stock_quantity with the
-- workbook number. Storefront sales deduct stock_quantity immediately, but the
-- workbook only learns about them through best-effort write-back; whenever that
-- write-back failed the next sync silently restored the sold units.
--
-- sheet_stock_quantity remembers what the workbook reported at the last sync so
-- the importer can apply the workbook's *change* since then instead of its
-- absolute value. Restocks entered in the workbook still flow through; sales
-- recorded only in the database are no longer erased.
alter table public.products
  add column if not exists sheet_stock_quantity integer;

-- Existing synced rows: treat the current inventory as the last known workbook
-- value, so the first sync after this migration is a no-op instead of a jump.
update public.products
  set sheet_stock_quantity = stock_quantity
  where source_key is not null
    and sheet_stock_quantity is null;

notify pgrst, 'reload schema';
