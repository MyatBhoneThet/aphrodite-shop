# Delivery, COD verification and RMA setup

## 1. Apply the database migration

Open Supabase Dashboard → SQL Editor → New query. Copy and run:

`supabase/migrations/20260902141853_delivery_rma_cod_tracking.sql`

The migration adds consented delivery coordinates, COD verification fields,
courier tracking, customer-visible delivery events, and private return-evidence
metadata. It enables row-level security and grants authenticated users read-only
access to only their own order records.

## 2. Create the private evidence bucket

In Supabase Dashboard → Storage:

1. Choose **New bucket**.
2. Name it exactly `return-evidence`.
3. Keep **Public bucket** off.
4. Set the file-size limit to 25 MB.
5. Allow `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, and
   `video/quicktime`.

Uploads and temporary signed links are created by the authenticated server with
the service-role key. Never expose that key in browser code.

## 3. Configure support details

Add these environment variables locally and to Google Cloud Run:

```env
RECEIPT_CURRENCY=MMK
NEXT_PUBLIC_SUPPORT_PHONE=your-store-phone
NEXT_PUBLIC_SUPPORT_EMAIL=your-support-email
```

Restart the app or deploy a new Cloud Run revision after changing variables.

## 4. COD operating process

1. The customer confirms the address and reachable phone at checkout.
2. The customer places a delivery pin on the map and explicitly confirms it.
   GPS is optional: customers can click or drag a pin without granting device
   location access. If the map is unavailable, request written-address
   confirmation by phone. See `MYANMAR_LOCATION_MMK_SETUP.md`.
3. Admin opens **Customer Purchases → COD & delivery details**.
4. Staff records phone verification, an optional COD deposit, or manual review.
5. Record the courier, tracking number, estimated arrival and each timeline
   event. Customers see those updates in My Orders.
6. High-value, repeated-refusal, unreachable, or unusual orders should be held
   for a phone callback or a small disclosed deposit. Never store an ID-card
   image unless there is a reviewed legal and privacy need.

Browser geolocation can be refused or spoofed. It must not be used as the sole
anti-fraud control, and checkout remains available using the written address.

## 5. Real courier tracking

The included version supports an admin-managed Lazada-style timeline. Automatic
live tracking requires a contracted Myanmar courier with an API or webhook. Map
the carrier events to `delivery_events` through a signed server webhook. Never
put carrier API secrets in client-side code.

## 6. RMA and COD refunds

Customers can open an RMA within seven days after delivery and upload private
photos/video or supply a secure external link. Admin approves, schedules pickup,
records inspection, and completes the refund record.

For COD refunds, collect only the minimum bank/mobile-wallet details in an
authenticated secure form after approval. Restrict access, keep an audit log,
and delete the details according to a documented retention period. Do not ask
customers to send full bank statements or national ID copies through email or
chat.

## 7. Product prices and Google Sheets

Dedicated `Retail Price MMK` and Banana-reference columns have now been added
to all three tabs of the current workbook. This importer uses `Retail Price MMK`
instead of inventory purchase costs when that header is present. Blank or
invalid retail values become **Price pending**, not free products. They remain
visible but cannot be ordered or used in a PC-budget recommendation.

See `MYANMAR_LOCATION_MMK_SETUP.md` for the completed rows, source references,
remaining price review, and exact sync steps. Wholesale prices/tiers are NOT
converted by this update and must be reviewed separately in admin before use.
