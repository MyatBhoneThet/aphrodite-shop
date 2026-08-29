# APD Google Sheet catalogue sync

The catalogue importer is configured for the shared APD Testing workbook:

`1PVS3wp7UvezKVeb1VL0ifpYMrgxWjpoAq0UXDu-RdXE`

It reads these tabs in one authenticated Google Sheets request:

- `Laptops!A:Q`
- `Accessories!A:AK`
- `PC Parts!A:AH`

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
- Price: `Price` or `Pur Cost`
- Inventory: `Qty`
- Details: `Specs (Detail)` and `Warranty`

### Accessories

- Name: `Model`
- Identity: Sheet + brand + category + model number/name
- Store family: accessory
- Price: closing `Pur Cost`, then purchase and opening cost as fallbacks
- Inventory: closing `Qty`; a dash or blank means zero
- Details: `Specs` and `Warranty`

### PC Parts

- Name: `Description`
- Identity: Sheet + brand + category + description
- Store family: PC part (stored with the existing accessory database type and
  identified by `source_sheet = 'PC Parts'`)
- Price: closing `Pur Cost`, then purchase and opening cost as fallbacks
- Inventory: closing `Qty`
- Details: `Description`

Repeated rows with the same identity become one store product. Quantities are
added and the highest available unit cost is used. Rows with a product name but
no valid positive price are skipped and reported by Dry Run.

The workbook has no image column. A new product uses
`/products/production-placeholder.svg`; later manual image edits in the admin
dashboard are preserved by future syncs.

## Audit snapshot (25 August 2026)

The shared workbook produced 465 unique products:

- Laptops: 16
- Accessories: 110
- PC Parts: 339
- Products currently in stock: 270
- Named rows skipped for invalid price: 0

All 465 products currently have the workbook price `1000`. The store displays
prices in Thai baht, so this becomes `฿1,000`. Confirm and correct the Sheet's
price data before a live Sync if `1000` is only test data. Dry Run shows this as
an amber warning in the admin dashboard.

Counts are a point-in-time audit; they change when the Sheet changes.

## Setup and first sync

1. Apply every SQL file in `supabase/migrations` in filename order. The product
   sync uses the existing `source_key`, `source_sheet`, and
   `sheet_stock_quantity` columns; no additional migration is required for this
   catalogue update.
2. Create a Google Cloud service account with Sheets API access.
3. Put `GOOGLE_SHEETS_CLIENT_EMAIL` and `GOOGLE_SHEETS_PRIVATE_KEY` in
   `.env.local`. The shared workbook ID is already the default;
   `GOOGLE_SHEETS_SPREADSHEET_ID` is only an override.
4. Share the Google Sheet with the service-account email. Viewer access is
   enough for imports. Editor access is required if checkout should write stock
   deductions back to the Sheet.
5. Start the app, sign in as an administrator, then open **Admin → Google Sheet
   Sync**.
6. Run **Dry Run** first. If the Sheet is unchanged from the audit above, it
   should show 465 products split 16 / 110 / 339 and zero skipped rows.
7. Review every warning, especially the uniform `1000` price warning. Then run
   **Sync Products**.

The sync upserts by stable `source_key`, writes the catalogue to Supabase in
safe batches, and preserves products created manually because they have no
Sheet source key. It also preserves a manually changed product image.
