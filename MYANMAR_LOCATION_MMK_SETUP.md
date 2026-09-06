# Myanmar delivery location, map pins and MMK prices

**Update:** [COD_B2B_SETUP.md](./COD_B2B_SETUP.md) adds sheet-managed wholesale
pricing (5% below approved retail, minimum 3 per product) and verified-business
access. Follow that guide for wholesale sync; older statements here saying that
wholesale columns are not imported refer to the previous version.

Updated 3 September 2026. Price references checked 2 September 2026.

## What is complete — and what is not

- The live Google Sheet has new MMK retail and Banana-reference columns in all three product tabs. Original inventory values and quantities were preserved and compared before/after.
- Of 468 source product rows, 19 have verified Banana reference prices; 9 have an MMK retail selling price. The remainder are pending review. This is **not a fully priced catalogue** and not every remaining model has been exhaustively researched.
- The website code includes a location explanation after customer login, an interactive delivery-pin map, and server-side Myanmar delivery checks.
- The new code has **not** been deployed to Google Cloud and the database has **not** been synced by this update. Editing the Sheet alone does not update the running website.
- Existing wholesale prices/quantity tiers are **not converted**. Review them in admin before allowing wholesale purchases. They must already be expressed in MMK.

## 1. Open the updated project safely

1. Keep your existing project folder as a backup.
2. Extract the supplied ZIP into a new folder. Open the inner `aphrodite-shop-delivery-rma` folder in VS Code (the folder with `package.json`).
3. Copy your working `.env.local` from the previous project into this new folder. Do not upload that file to GitHub or share screenshots of its contents. The ZIP does not contain your credentials.
4. In `.env.local`, set the current workbook ID:

```env
GOOGLE_SHEETS_SPREADSHEET_ID=1bQ3SVyRh5CD20JKCX-YWv0M30NdpTCafIfoDEI8NlN4
RECEIPT_CURRENCY=MMK
```

Keep your own Google service-account email/private key and Supabase settings. Do not replace those values with examples. If both `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` exist, they must identify the same correct project.

5. Use Node.js 22, then run these commands in the new project's terminal:

```sh
npm ci
npm run dev
```

6. Open `http://localhost:3000` in Chrome or Safari. If the terminal gives a different port, use that port. Do not add another `--webpack`: the scripts already include it.

There is no additional SQL migration for this update. Delivery-pin storage requires the previous delivery/RMA migration `supabase/migrations/20260902141853_delivery_rma_cod_tracking.sql`. If you have not applied it, follow `DELIVERY_RMA_COD_SETUP.md` first. Do not blindly rerun every old migration against an existing database.

## 2. Where customers see the location request

1. A customer signs in at `/login`.
2. The website displays **Where are we delivering?** Admins still go straight to the admin dashboard.
3. The customer presses **Allow location check**.
4. The browser asks permission if it has not already remembered a permission decision. Choose Allow to run the check; denying access does not prevent shopping.
5. The one-time check estimates whether the device is in Myanmar. These login coordinates are not saved, sent to an administrator, or reused as the delivery address.
6. Choose **Continue to shop**, or **Continue without location**.

You can preview this page without signing in at `/delivery-area`. The expandable practice map on that page does not save a pin to an account or order.

### If the browser does not show a permission popup

- Use the real website in Chrome/Safari, not a VS Code embedded preview. Embedding can be blocked by the site's security policy.
- Use HTTPS on the deployed website. Localhost is allowed for development; an ordinary HTTP network/IP URL may not be.
- Open the site's controls beside the browser address bar, find Location, change it to Ask or Allow, and reload. A remembered Allow or Block decision can mean there is no new popup.
- On your phone/Mac, ensure location services are enabled for the browser in system privacy settings.
- You can always place a delivery pin manually without GPS permission.

Reference: [browser geolocation permission requirements](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition).

## 3. How a customer pins the exact delivery entrance

1. Add a priced, in-stock item and open the cart/checkout page.
2. Enter the recipient's name, reachable phone, street/building, city, state/region and postal code. Country is fixed to Myanmar.
3. Under **Pin the delivery entrance**, read the map privacy explanation and choose **Open map to place a pin**.
4. Choose a starting city, then zoom and click the map. Drag the red pin onto the entrance. Alternatively use **Use my current location** only if you are at the delivery address.
5. Keyboard users can move the map with arrow keys and +/−, then press **Use map centre as pin**. Coordinates can also be entered manually.
6. Check the address and pin agree, then press **Confirm and share this delivery pin**. Moving/editing the pin cancels the previous confirmation, so confirm it again.
7. Confirm the COD address and reachable-phone statements, then place the order. Only the confirmed pin is submitted with the order.
8. If you cannot use the map, select **I cannot confirm a map pin. Please call…** and provide the full written address. That order remains pending staff verification.

A pin selected outside the approximate Myanmar boundary cannot be confirmed or submitted. Border/island mapping can be imperfect; use written-address verification if a valid Myanmar address is incorrectly excluded.

## 4. What an administrator can access

Open **Admin → Customer Purchases → the order → COD & delivery details**. A confirmed pin has an **Open customer-selected delivery pin** link. It opens the point in Google Maps. Manually selected pins are labelled unverified; GPS accuracy is shown only when it was supplied by the device.

An admin cannot see a customer's live location, follow their movements, or access the earlier login check. Only the order's consented delivery point is saved. Protect admin accounts and restrict order access to authorised staff. Adopt a retention period for delivery information and remove it when no longer needed for your business obligations.

## 5. Myanmar-only delivery and COD fraud prevention

The server validates the destination country/state, and checks any supplied pin against an approximate Myanmar boundary. It does not merely hide other countries in the browser.

This does **not** prove the address exists or the shopper is genuine: GPS and manual pins can be spoofed, a VPN affects IP estimates, and typed addresses can be false. Do not mark a customer "identity verified" because the map is inside Myanmar.

Customers physically overseas can buy for a recipient in Myanmar; this implementation restricts the **delivery destination**, not who may visit or log in. International shipping is not offered.

For COD, keep the existing pending verification process: call the recipient, confirm the building/landmark and courier coverage, and record verification in admin. For high-value or repeated failed deliveries, request a clearly disclosed deposit and manually check the payment in your merchant account before dispatch. This update does not add phone OTP, an automatic fraud score, advertising profiles, or continuous tracking.

## 6. What changed in your live Google Sheet

[Open the current workbook](https://docs.google.com/spreadsheets/d/1bQ3SVyRh5CD20JKCX-YWv0M30NdpTCafIfoDEI8NlN4/edit).

| Tab | New pricing range | Retail-price column |
| --- | --- | --- |
| Laptops | R6:Y26 | R |
| Accessories | AH6:AO119 | AH |
| PC Parts | AH6:AO349 | AH |

Headers remain on row 6. The eight new columns are:

1. Retail Price MMK — actual selling price imported by the updated app.
2. Banana Price THB — researched reference price.
3. MMK per THB — the fixed rate you requested, 134.
4. Banana Reference MMK — THB × 134, rounded to a whole kyat.
5. Price Source URL.
6. Price Checked At.
7. Price Status.
8. Price Notes.

The existing `1000` inventory costs were not multiplied or changed. They are separate accounting fields and were not reliable Banana selling prices. Existing stock quantities were not changed.

Example: the [Banana AMD catalogue](https://www.bnn.in.th/th/p/shop-by-brand-1/a/amd) listed Ryzen 5 7500F at THB 4,990 when checked. `4,990 × 134 = 668,660 MMK`.

Other references used include the [Intel promotion page](https://www.bnn.in.th/th/mkt/intel-gamer-day), [Intel catalogue](https://www.bnn.in.th/en/p/computer-hardware-diy?q=intel), and [printer catalogue](https://www.bnn.in.th/en/p/computer-hardware-diy/printer-and-supplies). Prices and availability can change; promotional prices may expire. The conversion does not include delivery/import costs, tax adjustments or your margin, and is not a live exchange-rate feed.

### Complete the remaining prices

- Read each row's Price Status and Price Notes. Review the exact model, variant, condition, package and source availability before entering a selling price.
- Used laptops and "MD Used" items must not automatically inherit a new retail product's price. Box/tray/"Next" variations or unclear allocation also need staff review.
- For a verified new item, enter the THB reference, rate 134, source and check date. In PC Parts/Accessories, reference MMK is `=ROUND(AI21*AJ21,0)` for row 21. If approved, retail can be `=AK21`. Adjust the row number for another item.
- In Laptops the same pattern is `=ROUND(S9*T9,0)` in U9, and `=U9` in R9 if approved.
- For a used item, enter your approved whole-MMK selling price directly in Retail Price MMK and explain the used-item pricing decision in Notes.
- Blank, zero or invalid Retail Price MMK means **Price pending**. The product stays visible but cannot be ordered or recommended as a free PC part. Most catalogue rows are currently in this state.
- Do not rename the three tabs or the `Retail Price MMK` header. Continue adding new products below existing rows with the same layout.
- Wholesale price/tier fields are preserved by sync, not imported from the new retail column. Check all wholesale amounts in admin separately before launch.

The TSV files in `docs/mmk-price-columns` are backups of only the added pricing columns. They are not XLSX files and do not contain the whole inventory. Do not paste them at A1. The sheet is already edited; no paste is needed now. Their formulas depend on the listed destination columns and row positions.

## 7. Sync and deploy the update

1. Finish/review selling prices before switching the live store. If you sync now with this code, unapproved products will show Price pending and cannot be bought.
2. Give your Google service account access to this sheet. Viewer permits importing; Editor is needed for the existing checkout stock write-back.
3. Start the new project with your working environment settings and sign in as a real admin.
4. Open **Admin → Google Sheet Sync → Dry Run**. Review pending-price and mapping warnings. The inspected sheet contained 468 source product rows; grouped product counts can be lower due to shared identities and will change if you edit the workbook.
5. Once you approve the preview, choose **Sync Products**. Then check a priced product, a pending product, the cart and a test order. The sheet parser was tested against the exported edited workbook, but no live database sync or purchase was performed for you.
6. When local checks pass, commit only source files plus `package.json`/`package-lock.json` to your intended GitHub branch. Never commit `.env.local` or downloaded service-account keys.
7. Deploy the new commit through your existing Google Cloud build trigger. Ensure the trigger uses the branch you pushed and finds `cloudbuild.yaml` at the repository root. Set the current Sheet ID and working credentials in Cloud Run too. A GitHub push alone is not proof a deployment succeeded.
8. Confirm the latest build is successful and the latest Cloud Run revision is serving traffic; then test the deployed HTTPS site.

Important: switch Google Sheet sharing away from **Anyone with the link can edit** after review. Keep edit access only for trusted staff and the stock-sync service account. Otherwise anyone with the link could change your production prices and quantities. Rotate any private keys/service-role credentials exposed in earlier screenshots or commits.

## 8. Map hosting and changed code

Leaflet 1.9.4 is included through npm. The optional map currently uses OpenStreetMap standard tiles with visible attribution and normal browser caching, without bulk/offline downloads. It has no API key and no uptime guarantee. Follow the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/); choose a suitable commercial or self-hosted tile provider before relying on it for high-volume production. The tile URL is in `app/components/DeliveryMap.tsx`.

Main changes:

- Login: `app/login/page.tsx`, `app/components/DeliveryLocationWelcome.tsx`, `app/delivery-area/page.tsx`.
- Interactive pin: `app/components/DeliveryMap.tsx`, `app/components/DeliveryPinPicker.tsx`, `app/cart/page.tsx`, `app/admin/page.tsx`.
- Delivery validation: `app/lib/delivery-country.ts`, `app/lib/validation.ts`, `app/lib/backend.ts`, `app/data/myanmar-boundary.json`.
- MMK import: `app/lib/google-sheets.ts`, `.env.example`.
- Pending-price displays and guards: formatting, product/list/wishlist/compare components, PC builder, chatbot product recommendations, and checkout.
- Tests cover Myanmar destinations, manual pin consent, foreign/invalid pins, pending checkout prices, importer behavior and PC-builder exclusions.

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` after any further changes.
