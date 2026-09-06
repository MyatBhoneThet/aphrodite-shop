# COD verification and B2B pricing — installation guide

## What is finished, and what is not live yet

The replacement source includes the COD form fix, stronger staff verification, four homepage categories, business-only wholesale eligibility, and Google Sheet wholesale syncing.

The live Google Sheet now has wholesale formulas on all three tabs. Its original inventory, quantities, serial numbers and retail prices were not changed in this update. All 468 source rows were checked; they group into 464 unique products: 16 laptops, 110 accessories and 338 PC parts. Nine products currently have a reviewed retail MMK price and a wholesale price. The other 455 products remain price pending. No prices were guessed for used or uncertain variants.

This package has NOT been pushed to GitHub or deployed to GCP. The new migration and live product sync have NOT been run. Install this code before activating the database checks: the old COD dialog does not send the required staff review fields.

## 1. Install the replacement project

1. Keep a backup of your current project. Extract the new ZIP into a separate folder. Do not overwrite your only working copy.
2. Open the extracted `aphrodite-shop-delivery-rma` folder in VS Code.
3. Copy your own `.env.local` from the working project into this folder. It is intentionally not included in the ZIP. Do not send its contents or commit it to GitHub.
4. Open Terminal in that folder. With Node.js 22 installed, run:

```sh
npm ci
npm run dev
```

5. Open the localhost address printed by the terminal. `--webpack` is already in the development script; you do not need to add it again.

Keep your existing Supabase URL, anon key, service-role key and Google Sheets service-account configuration. Google Sheet ID:

```text
1bQ3SVyRh5CD20JKCX-YWv0M30NdpTCafIfoDEI8NlN4
```

If you have made newer changes in another project since the supplied source, compare/merge those before replacing it. Do not overwrite unrelated work.

## 2. Apply the new SQL migration

Coordinate this with installing the new code. Do not apply it while staff still need to confirm orders using the old dialog. Make a database backup first.

1. Open your Supabase project.
2. Open **SQL Editor → New query**.
3. In VS Code open `supabase/migrations/20260903041011_cod_business_verification.sql`.
4. Copy that file's entire contents into the SQL Editor, then click **Run**.
5. Wait for success. Refresh the admin page.

**Do not run `supabase/schema.sql` over your existing production database.** This migration assumes the earlier wholesale, customer settings, sheet-stock, receipt and delivery/RMA migrations are already installed. If you see a missing table or column, stop and check the earlier migration named in the error; do not delete tables to get past it.

The new migration adds private COD reviews, business verification fields, protected pricing access, an atomic delivery-update function, and a sheet-managed `Sheet B2B (MMK)` price list. It does not rewrite old order totals, payment records, stock or customer roles. Existing wholesale accounts must be verified as businesses before the updated application gives them B2B prices. A second run of this migration is safe, but normal deployments should track it once.

## 3. Secure the Google Sheet, then sync

Your sheet currently permits anyone with the link to edit. That permits strangers to change prices and stock and also exposes the wholesale prices.

1. As the sheet owner, open **Share**.
2. Change **General access** to **Restricted**.
3. Give edit access only to trusted staff and the service-account email used by your website. The existing checkout integration writes quantity changes back to the sheet, so that service account needs Editor access.
4. In the updated website, log in as a real admin and open **Google Sheet Sync → Dry Run**.
5. Review the category counts, pending-price warnings and preview. Blank retail MMK prices intentionally import as price pending and cannot be purchased; they do not fall back to the old 1,000 cost entries.
6. Click **Sync Products**. Check both a priced product and a price-pending product afterwards.

Do not repeatedly click Sync while it is running. If the product step succeeds but wholesale fails, correct the migration/configuration error and rerun: product source keys and tier uniqueness prevent duplicate products/tiers, and stock-delta logic avoids resetting reserved stock.

### Sheet columns

| Tab | Existing retail price | New wholesale fields |
|---|---|---|
| Laptops | R — Retail Price MMK | Z:AD |
| Accessories | AH — Retail Price MMK | AP:AT |
| PC Parts | AH — Retail Price MMK | AP:AT |

The five new headers are Wholesale Price MMK, Wholesale Min Qty, Wholesale Discount, Wholesale Status and Wholesale Notes. Headers are on row 6.

- Your approved rule: whole-MMK retail price × 95%, rounded to a whole kyat, for **3 or more units of the same product**.
- Two units of product A plus one of product B do not qualify.
- Fewer than three units may still be bought at the retail price.
- Blank/unapproved retail prices leave wholesale blank and pending.
- These are your store's discounts, not supplier wholesale quotations. Confirm your costs and margin before selling.
- Existing Banana reference conversion remains **1 THB = 134 MMK**, your chosen fixed rate. This is not a current exchange-rate claim or automatic price scraping.
- Add/review the actual selling price in the retail MMK column, then extend the wholesale formulas to any newly appended rows. Copy formulas from a nearby row using Google Sheets Fill Down so row references adjust.
- Keep exact model, variant, condition, source URL and check date with your price review. Used products need their own approved price.

The TSVs in `docs/wholesale-sheet-columns` back up only the newly added columns. They are not XLSX files. **No paste is needed now**; the live sheet is already edited. Do not paste these at A1 or after rearranging rows.

## 4. Grant B2B access to a genuine business

1. The customer registers a normal account and completes your configured email confirmation.
2. Contact the business independently. Check its shop/business name, business contact, address and reseller purpose. Do not rely on a shared six-digit invitation code as business verification.
3. Open **Admin → Wholesale** and find the customer.
4. Select **Sheet B2B (MMK)** and click **Verify business / grant B2B**.
5. Enter the business name and a short private review note. Do not put national ID numbers, bank details or passwords in the note.
6. Check the attestation only after actually completing the checks, then approve.
7. Ask the customer to refresh/sign in again. At quantity 3, a priced item should show the wholesale total. At quantity 2, it should use retail. A retail account must not receive a wholesale tier in the API response.

Use Suspend or Revoke if business eligibility ends. Existing custom price lists remain separate; sheet sync only manages the `Sheet B2B (MMK)` list. Do not manually edit its tiers expecting those edits to survive the next sync.

## 5. Process a cash-on-delivery order

1. Customer enters a Myanmar delivery address and reachable phone number, confirms the cash total and submits the order. A manual map pin or written-address callback is supported; GPS permission is not mandatory.
2. Order starts **Pending / unpaid**. At most three pending unpaid COD orders per account are allowed by the new database check. This reduces duplicates; it does not identify a person across multiple accounts.
3. Admin opens **Customer Purchases → COD & delivery details**. This is now a page form, not `window.prompt()`, fixing the error in your screenshot.
4. Call the number on the order. Confirm the item, variant, quantity, cash total, recipient, township, landmark and availability. Check actual stock and the courier's service area/COD collection limit.
5. Record a short private callback note, tick the completed phone and address checks, choose **Approved for COD**, then save.
6. Change the order status to **Confirmed**. The existing confirmation/receipt workflow runs. A confirmation receipt is not evidence that COD cash has already been collected.
7. Enter the real courier name, reference/tracking number and estimated arrival. Add a **packed** event. Change the order to **Shipped** when dispatched, then add genuine courier updates.
8. Mark **Delivered** only after confirming delivery and cash collection. In the existing workflow this also marks COD payment collected. An optional delivered timeline event is added afterwards; an event alone does not collect payment.

No phone callback means no approval or dispatch. Rejected/On hold does not automatically cancel the order or restock it: use the existing cancellation action if cancellation is intended. Address/amount changes invalidate the saved review. Private notes and review history are admin-only; the customer sees the courier, ETA and public timeline messages.

There is no automatic SMS OTP, courier booking, live courier GPS or automatic cash refund in this update. Delivery events are staff-entered facts, and arrival times are estimates. Do not enter invented courier progress. A browser location or manually selected map pin can be inaccurate/spoofed; it is not proof of identity and a denied permission is not a fraud finding. No location-based marketing is added.

## 6. Test before production

- Retail vs verified B2B: 2 units retail, 3 units wholesale; suspended/unverified account retail.
- Incomplete COD review: approval and confirmation blocked.
- Complete callback/address review: approval succeeds; shipping requires courier/reference.
- Price-pending product: cannot add to cart or check out.
- Repeated sync: no duplicate source keys/tiers and no restored sold stock.
- Customer account: cannot see private reviews or someone else's orders.
- Return/cancellation and receipt flows: test with a controlled test account, not a real purchase.

Verification performed for this package: production build and TypeScript pass; 158 tests including the local live-sheet export test; 26 disposable PostgreSQL checks including permissions, transaction rollback, repeat migration, duplicate pending orders and tier idempotency. Lint has no errors and five pre-existing image warnings. Browser testing used dummy orders and mocked API responses; no real callback, order, email, refund or live sync was performed.

After local testing, deploy the replacement source with your normal GitHub/GCP process. Apply production environment variables separately; `.env.local` is not uploaded. Confirm Cloud Build succeeds and Cloud Run uses the new revision. This task did not push or redeploy for you.

Rotate any Supabase service-role key or Google private key exposed in earlier screenshots/commits. Restrict sheet sharing before using it as a production pricing source.
