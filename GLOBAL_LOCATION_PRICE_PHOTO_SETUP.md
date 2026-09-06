# Location, price and product-photo setup

## Customer location

The website now asks signed-in customers for permission before sharing one device position. It accepts coordinates from any country; Myanmar delivery rules are kept separate. It stores latitude, longitude, browser accuracy, consent version and capture time for at most 30 days. It does not continuously track a customer and a GPS result is not identity proof.

1. Run the migration in `supabase/migrations/20260906063534_customer_location_shares.sql` (it has already been applied to the configured Supabase project in this working copy).
2. Deploy the application over HTTPS. Browsers normally block geolocation on plain HTTP except localhost.
3. Customers can use the banner or `/location`, then choose **Allow and share location**. They can remove the saved position at any time.
4. An administrator opens an order and chooses **Customer location**. The API checks admin role on the server before returning the position. The link opens a map centered on the reported coordinates.

Do not reject an order only because a customer refuses location sharing. Use phone verification, address confirmation, COD review and a delivery callback as the actual fraud controls.

## MMK pricing

The importer reads `Retail Price MMK` as the authoritative retail price. A blank or non-positive value becomes **Price pending**, not a free product. Keep the source price in `Banana Price THB`, the exchange rate in `MMK per THB`, the calculated reference in `Banana Reference MMK`, and record a direct source URL and checked date.

Use `=ROUND(AI10*AJ10,0)` (adjust the row) for the reference conversion. Do not copy a price from a different model, package, used/new condition or warranty. For used laptops, enter a store-approved selling price only after checking condition; otherwise leave the retail cell blank and add `NEEDS EXACT PRICE` in the status column.

Wholesale is calculated separately at 5% below the approved retail price with a minimum quantity of 3. It must never turn a pending retail price into a purchasable product.

## Product photos

Each product tab now has these five maintenance columns:

`Front Image URL`, `Rear Image URL`, `Side Image URL`, `Gallery Image URLs`, `Photo Source URL`.

Put one HTTPS image URL in each angle column. Put additional URLs separated by `|` in `Gallery Image URLs`. The product page validates HTTPS URLs, removes duplicates and shows thumbnails with previous/next controls. The admin product editor also has a gallery field for products maintained directly in Supabase.

Only use images that Aphrodite has permission to publish. The sheet currently contains a verified JIB gallery for the matching Samsung Odyssey OLED G8 rows as an example; do not reuse that gallery for another model. For the remaining products, map the exact model number and condition first, then paste the retailer's direct image URLs and source product page.

## Sync checklist

1. Run **Dry Run** in the admin Google Sheet Sync page.
2. Resolve every mapping warning and every `NEEDS EXACT PRICE` row you want to sell.
3. Confirm the sheet contains the five photo columns and the price/source columns.
4. Run **Sync Products**.
5. Confirm the result count and open one laptop, one accessory and one PC part to verify the gallery and price.
