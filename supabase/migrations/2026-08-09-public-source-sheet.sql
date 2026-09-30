-- Storefront sections are grouped by the production workbook tab a product
-- came from (Laptops / Accessories / PC Parts), so clients need to read
-- source_sheet. source_key stays server-only.
grant select (source_sheet) on public.products to anon, authenticated;

notify pgrst, 'reload schema';
