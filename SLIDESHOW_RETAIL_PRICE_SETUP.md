# Slideshow and retail-price update — 6 September 2026

## What is completed

- The homepage has a rectangular three-slide banner, arrow buttons, slide selectors, and pause/play. It pauses on hover/focus and respects reduced-motion preferences.
- The original welcome headline, description and shopping links remain. The “MMK PRICES” heading suffix and the three pricing/COD/wholesale labels have been removed from the banner only. Payment and B2B functionality remain.
- Product sync now uses **Retail Price MMK only**. Purchase cost is never substituted as the selling price. This fixes the repeated MMK 2,000 prices.
- Blank or zero retail prices remain **Price pending**, with purchasing disabled. They are not free products.
- The live Google Sheet was updated and all 464 existing products were synced to Supabase. Product IDs and stock quantities were unchanged. Two monitor placeholders were replaced by images already present in your sheet gallery.
- 115 active wholesale tiers were verified: 5% below retail, minimum 3 units of the same product.
- No new SQL migration is needed for this particular update on your existing database.

## Pricing coverage — not all products are priced yet

| Category | Products | Priced | Still pending |
|---|---:|---:|---:|
| Laptops | 16 | 6 | 10 |
| Accessories | 110 | 33 | 77 |
| PC Parts | 338 | 76 | 262 |
| Total | 464 | 115 | 349 |

93 sourced price rows were refreshed during this update, including 23 newly priced rows. Previously entered prices and your concurrent spreadsheet formulas were preserved. Sources include JIB, Banana, Advice and an explicitly identified used-laptop seller. The complete research and pending-product reports accompany this download.

**Important:** Some retailer listings are sold out or show historical last-listed prices. Those rows are labelled accordingly. They are reference prices, not current stock or supplier quotes. Used products may differ in condition, battery, screen, warranty or accessories. Many remaining rows need more research or exact model/condition information; none were filled with fabricated prices. Review these references before accepting orders. The fixed conversion is your requested **134 MMK per THB**, not a claim about the market exchange rate. Import fees, delivery and your margin are not added.

## Install the updated code

1. Keep a backup of your current project. Do not delete it.
2. Unzip the supplied full-code archive into a **new folder** and open that folder in VS Code.
3. Privately copy your existing `.env.local` into the new project folder, beside `package.json`. It is deliberately absent from this download. Do not paste it into chat or commit it to GitHub. Rotate any credentials previously exposed in screenshots or Git history.
4. In VS Code choose **Terminal → New Terminal**. Check that the terminal is inside the new project folder.
5. Install dependencies:

   ```sh
   npm ci
   ```

6. Start the website:

   ```sh
   npm run dev
   ```

7. Open the localhost address printed in the terminal. If another project already uses port 3000, stop that project's server with Ctrl+C or use the new port shown.
8. Log into admin, open **Google Sheet Sync**, and click **Dry Run**. Check the counts and pricing warnings. Click **Sync Products** only when the sheet is ready. The current live database has already been synced for this update.
9. Refresh the storefront. Example checked: HP EliteBook 840 G8 = **MMK 1,821,060**; Dell Latitude 5320 = **MMK 1,204,660**. Products without a verified retail price intentionally show **Price pending**.

If you prefer to merge just this update into a project with your own additional edits, review/copy these files rather than replacing your whole project:

- `app/components/HeroSlider.tsx`
- `app/data/home-ads.ts` (new)
- `app/lib/google-sheets.ts`
- `tests/google-sheets-production.test.ts`
- `public/ads/README.md` (new)

Keep your own `.env.local`, product photos and unrelated changes. Do not copy `node_modules` or `.next` from another project; use `npm ci`.

## Add your own slideshow advertisements

1. Prepare a JPG, PNG or WebP banner. Recommended size: **1600 × 600 pixels** (8:3).
2. Put it in `public/ads/`, for example `public/ads/september-laptops.webp`.
3. Open `app/data/home-ads.ts`.
4. Add the following two properties inside the first slide object, keeping its existing title and link:

   ```ts
   image: "/ads/september-laptops.webp",
   imageAlt: "September laptop promotion from Aphrodite Myanmar",
   ```

5. Set `href` to the page that should open when someone clicks the banner, for example `/catalog/laptops`.
6. Repeat for the second and third objects. You can add or remove slide objects. With one slide, the slideshow controls are hidden.
7. Save. The development site reloads automatically. Images are shown without cropping. If no image is provided, the default text slide remains. A broken image falls back to the text slide.

The slideshow changes every six seconds. Manual navigation pauses autoplay; click Play to resume, then move the pointer/focus away. Reduced-motion users navigate manually. This update uses a configuration file, not an admin ad-upload screen.

## Update prices in Google Sheets later

The workbook keeps the historical column name **Banana Price THB**, even when a quote is from JIB or Advice. **Price Source URL** identifies the actual shop.

| Field | Laptops | Accessories / PC Parts |
|---|---|---|
| Retail Price MMK — website selling price | R | AH |
| Banana Price THB — Thai reference | S | AI |
| MMK per THB | T | AJ |
| Reference conversion | U | AK |
| Price Source URL | V | AL |
| Price Checked At | W | AM |
| Price Status | X | AN |
| Price Notes | Y | AO |
| Wholesale Price MMK | Z | AP |
| Wholesale minimum quantity | AA | AQ |

For a verified quote, fill the THB reference and source URL on the **same product row**. Confirm model, storage, RAM, colour, condition and package version. Leave unavailable or uncertain selling prices pending.

Example formula for laptop row 9:

```text
=IF(AND(ISNUMBER(S9),S9>0),ROUND(S9*T9,0),"")
```

Example formula for accessory or PC-part row 10:

```text
=IF(AND(ISNUMBER(AI10),AI10>0),ROUND(AI10*AJ10,0),"")
```

Put the formula in **Retail Price MMK** if you want that row's selling price to follow the reference. Use the actual row number. Alternatively enter your approved MMK selling price manually. Do not multiply an existing MMK amount by 134 again. Keep the wholesale formula at `ROUND(retail*0.95,0)` and the minimum quantity at 3.

Changing THB alone does **not** change a retail cell containing a manually entered number. This is intentional: the website imports the retail column, not the reference column. After editing the sheet, use Admin → Google Sheet Sync → Dry Run → Sync Products.

Do not rename tabs or delete stock IDs. Do not copy an entire price block over another category: the column positions differ.

## Deploying to Google Cloud

The live sheet and database are updated, but this new UI/code has **not** been pushed to GitHub or deployed to Cloud Run. Your old deployed importer could reintroduce the old cost fallback if you sync through it before deploying this code.

1. Test the new folder locally.
2. Merge the listed code changes into the Git repository/branch your Cloud Build trigger uses (previously `main`). Commit only reviewed project files, never `.env.local`.
3. Push that branch.
4. In Cloud Build, confirm a successful build for the new commit. Confirm `cloudbuild.yaml` is present at the path configured in the trigger.
5. In Cloud Run, confirm the new revision is serving traffic. A successful GitHub push alone does not prove deployment succeeded.

## Verification performed

- TypeScript check passed.
- Production build passed.
- Automated tests: 161 passed, 1 optional live-fixture test skipped.
- Live sheet read-back: zero mismatches; stock data, IDs, unrelated formulas and image columns preserved.
- Database read-back: all 464 product prices match their sheet retail prices; IDs and stock quantities preserved.
- Wholesale validation: 115 active tiers, zero price/minimum-quantity mismatches.
- Local browser: rectangular slideshow and navigation checked; retail/pending prices verified in the laptop catalogue.
