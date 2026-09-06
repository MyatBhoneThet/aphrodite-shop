# APD Google Sheet catalogue sync

The catalogue importer now defaults to the current edited workbook:

`1bQ3SVyRh5CD20JKCX-YWv0M30NdpTCafIfoDEI8NlN4`

For the September 2026 MMK update and actual pricing progress, read
`MYANMAR_LOCATION_MMK_SETUP.md` in the project root first.

It reads these tabs in one authenticated Google Sheets request:

- `Laptops!A:AZ`
- `Accessories!A:AZ`
- `PC Parts!A:AZ`

The Sheet remains the inventory source. The application does not change its
layout or product descriptions during an import. The only Sheet write is the
best-effort stock deduction performed after a successful checkout.

## Supported Sheet layout

The `Laptops` tab has one header row. `Accessories` and `PC Parts` use two
header rows: a dated group such as `Opening Inv Jul'2026`, `Pur of Jul'2026`, or
`Closing Inv (31.07.2026)`, followed by `Qty`, `Pur Cost`, and `Amount`.

The importer locates columns by labels instead of a fixed header row number. It
also supports the older flattened labels (`ClosingQty`, `ClosingUnit Cost`, and
similar) so a previously exported workbook remains usable. Month/date text can
change without a code update. Renaming a tab or a structural label requires an
adapter update and tests.

## Product mapping

### Laptops

- Name: `Model`, with `Model No` as fallback
- Identity: Sheet + brand + model number/name
- Store family/category: laptop / `Laptop`
- Price: `Retail Price MMK`; legacy cost fallback only when that header is absent
- Inventory: `Qty`
- Details: `Specs (Detail)` and `Warranty`

### Accessories

- Name: `Model`
- Identity: Sheet + brand + category + model number/name
- Store family: accessory
- Price: `Retail Price MMK`; legacy cost fallback only when that header is absent
- Inventory: closing `Qty`; a dash or blank means zero
- Details: `Specs` and `Warranty`

### PC Parts

- Name: `Description`
- Identity: Sheet + brand + category + description
- Store family: PC part (stored with the existing accessory database type and
  identified by `source_sheet = 'PC Parts'`)
- Price: `Retail Price MMK`; legacy cost fallback only when that header is absent
- Inventory: closing `Qty`
- Details: `Description`

Repeated rows with the same identity become one store product. Quantities are
added and the highest available retail price is used. With a `Retail Price MMK`
header, named rows without an approved positive price remain in the catalogue
as Price pending and cannot be ordered. A missing MMK header triggers a warning
and retains the old cost fallback for older workbooks; it does not convert THB.

The workbook has no image column. A new product uses
`/products/production-placeholder.svg`; later manual image edits in the admin
dashboard are preserved by future syncs.

## Historical audit snapshot (25 August 2026 — different workbook)

The previous shared workbook produced 465 unique products:

- Laptops: 16
- Accessories: 110
- PC Parts: 339
- Products currently in stock: 270
- Named rows skipped for invalid price: 0

Those products had the placeholder value `1000`. The current app uses MMK and
dedicated retail columns, so do not use this historical snapshot as a current
count or as a price source.

Counts are a point-in-time audit; they change when the Sheet changes.

## Setup and first sync

1. Check that the existing product-sync migrations were applied. The importer
   uses `source_key`, `source_sheet`, and `sheet_stock_quantity`. No additional
   SQL migration is needed for this MMK update; do not blindly rerun all older
   SQL files against an existing database.
2. Create a Google Cloud service account with Sheets API access.
3. Put `GOOGLE_SHEETS_CLIENT_EMAIL` and `GOOGLE_SHEETS_PRIVATE_KEY` in
   `.env.local`. The shared workbook ID is already the default;
   `GOOGLE_SHEETS_SPREADSHEET_ID` is only an override.
4. Share the Google Sheet with the service-account email. Viewer access is
   enough for imports. Editor access is required if checkout should write stock
   deductions back to the Sheet.
5. Start the app, sign in as an administrator, then open **Admin → Google Sheet
   Sync**.
6. Run **Dry Run** first and check counts against the current workbook, not the
   older historical snapshot above.
7. Review every warning, especially pending prices. After approving the prices,
   run **Sync Products**.

The sync upserts by stable `source_key`, writes the catalogue to Supabase in
safe batches, and preserves products created manually because they have no
Sheet source key. It also preserves a manually changed product image.
