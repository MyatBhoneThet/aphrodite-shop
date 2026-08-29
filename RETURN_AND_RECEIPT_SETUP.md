# Digital Receipt, Return, Pickup, and Refund Setup

## What was added

- A branded printable digital receipt under each confirmed order.
- Optional receipt email delivery through Resend after administrator confirmation.
- Administrator cancellation for pending or confirmed orders, including the `out_of_stock` reason.
- A customer return form with exact reasons: defective, wrong item, wrong colour, wrong storage, delivery damage, or other.
- A strict 7-day request window measured from the recorded delivery time.
- Courier pickup or store drop-off selection.
- Separate administrator steps for approval, scheduling, receipt/inspection, safe restocking, and refund recording.
- A public `/returns` policy page and status details under `/orders`.

## 1. Apply the database migration

For an existing Supabase project, open the Supabase SQL editor and run:

`supabase/migrations/20260822175607_order_receipts_returns_and_admin_cancellation.sql`

For a new project, first run `supabase/schema.sql`, then apply all files in `supabase/migrations/` in filename order. The newest migration uses row locks for every lifecycle change, validates ownership or administrator role, and grants the workflow functions only to `service_role`.

## 2. Configure the application

Copy `.env.example` to `.env.local` and enter your own Supabase values. Never upload or share `.env.local`.

The printable website receipt works without an email provider. To send a receipt email after confirmation, set:

```env
APP_URL=http://localhost:3000
RESEND_API_KEY=re_your_key
RECEIPT_FROM_EMAIL=Aphrodite Myanmar <receipts@your-verified-domain.com>
RECEIPT_CURRENCY=THB
```

Use a sender/domain verified in Resend. Restart `npm run dev` after changing environment variables.

## 3. Order confirmation and receipt flow

1. Customer places a cash-on-delivery order.
2. Administrator opens **Admin → Customer Purchases**.
3. Administrator changes **Pending** to **Confirmed**.
4. The server creates one receipt number, records the confirmation time, and attempts the receipt email once.
5. Customer opens **My Orders → View / print receipt** and can choose **Print / Save PDF**.
6. When the administrator marks the order delivered, payment becomes collected and the return clock begins.

The confirmation receipt clearly says cash is still due until delivery. It is not presented as proof of payment while `payment_status` is `unpaid`.

## 4. Administrator out-of-stock cancellation

1. Open **Customer Purchases**.
2. For a Pending or Confirmed order choose **Cancel / out of stock**.
3. Select the reason and enter a customer-facing explanation.
4. Confirm. The database locks the order, marks it cancelled, and restores every reserved product quantity once.

Shipped, delivered, returned, or already-cancelled orders cannot use this action.

## 5. Customer return flow

1. Customer opens **My Orders** within 7 days after delivery.
2. Customer selects the exact problem, describes it, and chooses courier pickup or store drop-off.
3. Administrator approves or rejects the request. Approval does not change payment or inventory.
4. Administrator schedules the handover and provides instructions/tracking.
5. After the machine arrives, administrator chooses **Receive & inspect**, records inspection notes, and decides whether it can return to sellable inventory.
6. Only a sellable item is restocked. A defective or damaged item stays out of sellable inventory.
7. Staff sends or pays the refund using the agreed method.
8. Administrator chooses **Record refund**, enters the amount, method, and payment reference. The order then becomes Returned/Refunded.

Important: recording a refund does not transfer money. Cash, bank, and wallet payments must be completed by authorised staff or a separately integrated payment provider before the record is marked complete.

## 6. Free chatbot and live chat

The **Instant help** tab is a free rule-based assistant. It runs inside the website and does not send prompts to an external AI service. It can recommend in-stock products from the loaded catalogue and answer common receipt, delivery, cancellation, and return questions.

The **Live support** tab is the existing private customer-to-admin conversation stored in Supabase. Customers must sign in. Administrators reply from the Live Chat section of the single admin dashboard.

## Production checklist

- Review `/returns` with your business and a qualified local adviser before publishing.
- Test the full flow with one Pending order and one Delivered order in a staging Supabase project.
- Verify that a damaged return does not increase sellable inventory.
- Verify the actual refund outside the app before recording it complete.
- Confirm the receipt sender/domain and use the production website URL.
- Rotate any secret that was previously shared in a ZIP, screenshot, chat, or repository.
