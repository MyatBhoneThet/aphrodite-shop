# Verification for this delivery

- `npm test`: 144 tests passed across 19 test files.
- `npm run build`: production build and TypeScript checks passed.
- `npm run lint`: no errors; five existing image-optimisation warnings remain.
- Browser checks: the location explanation loads; the map loads after opt-in; a manually entered Yangon pin can be confirmed; changing the pin invalidates confirmation; a Bangkok pin cannot be confirmed; Remove pin clears the selected point and confirmation.
- No actual device GPS permission was granted during testing. No customer coordinates were collected for these checks.
- Actual login, live Supabase writes, a real COD order and Google Cloud deployment were not tested because production credentials and the deployed environment were not used.

## Google Sheet verification

The workbook was exported before and after the live edit and compared with the spreadsheet tooling. Existing values in all three original inventory ranges were unchanged. All 468 source product rows were checked for the new pricing-column alignment and formulas. Nine retail-price rows were populated, with 19 total Banana-reference rows.

The edited workbook was also passed through the real project parser in a temporary local QA test: 468 source rows, zero skipped rows, nine positive-priced grouped products, and no legacy-cost fallback warnings. That temporary test and private full-workbook exports are intentionally not included in this source ZIP. The normal reusable importer tests remain in `tests/`.

This verifies the importer against the inspected workbook, not a completed live sync to Supabase. Price coverage remains partial; see the main setup guide before syncing.
