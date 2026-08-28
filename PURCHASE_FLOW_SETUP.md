# Customer Purchase Setup

## Implemented access rules

- Visitors can browse, search, compare, and view product details.
- Cart, wishlist, checkout, orders, cancellations, and returns require login at both the screen and API levels.
- Live customer support requires login and connects each account to a private
  administrator conversation.
- Public registration always creates a normal customer. Admin roles cannot be selected during registration.
- Administrators view all customer purchases and resolve customer requests.

## Setup

1. Install Node.js 20 or newer.
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local` and add the Supabase URL, anon key, and server-only service-role key.
4. For a new database, run `supabase/schema.sql`.
5. For an existing database, apply every file in `supabase/migrations/` in
   order. Apply `2026-07-28-cod-order-lifecycle.sql`, followed by
   `2026-07-28-live-support-chat.sql`, followed by
   `2026-07-29-customer-settings-recently-viewed.sql`.
6. Create an admin with the instructions in `ADMIN_SETUP.md`.
7. Run `npm run dev` and open `http://localhost:3000`.

Important: copying a migration file into the `supabase/migrations` folder does
not apply it to a hosted Supabase project. Open the Supabase dashboard, choose
**SQL Editor**, paste the complete migration, and select **Run**.

## Fix: checkout_order is missing from the schema cache

If the terminal says:

```text
Could not find the function public.checkout_order(...) in the schema cache
```

the website code and database schema are out of sync. Fix it as follows:

1. Open `supabase/migrations/2026-07-28-cod-order-lifecycle.sql`.
2. Copy the complete file, from the first `alter table` through the final
   `notify pgrst, 'reload schema';`.
3. In your Supabase project, open **SQL Editor → New query**, paste it, and
   select **Run**.
4. Verify that the query finishes with `Success. No rows returned`.
5. Return to the cart and place the order again. Restarting Next.js is optional;
   the final `notify` refreshes Supabase's REST schema cache.

Do not replace `app/lib/supabase.ts` to fix this error. Its 13 RPC parameter
names already match the migration; the missing database function is the cause.

## Customer flow

1. Register and log in.
2. Open a product and add it to the cart.
3. Complete the COD form: recipient, phone, address lines, city/district, province/state, postal code, country, and optional note.
4. Place the order. Prices are recalculated on the server; order creation, inventory deduction, and cart clearing happen in one transaction.
5. Open **Orders** to track the order and payment state.
6. Pending or confirmed orders can request cancellation.
7. Delivered orders can request a return.

## Administrator flow

1. Log in as an admin and open `/admin`.
2. Select **Customer Purchases**.
3. Progress orders `pending → confirmed → shipped → delivered`.
4. Delivered COD orders become `collected`.
5. Approve or reject cancellation requests.
6. Accept or reject return requests.

Cancellation approval and return acceptance restore inventory in the same database transaction. Return acceptance marks the order returned and COD payment refunded. A request must still be pending, preventing repeated approval from restoring stock twice.

When an administrator selects **Approve** or **Reject**, the page opens its own
confirmation dialog. Enter an optional customer note and select the final
confirmation button. The admin page intentionally does not use
`window.prompt()`, because embedded preview browsers do not support it.

If an older copy shows `Error: prompt() is not supported`, replace
`app/admin/page.tsx` with the corrected file, restart the development server,
and refresh `/admin`.

## API examples

Place an order with `POST /api/orders`:

```json
{
  "shipping_name": "Customer Name",
  "shipping_phone": "+66 81 234 5678",
  "shipping_address_line1": "123 Test Road",
  "shipping_address_line2": "Unit 4",
  "shipping_city": "Bangkok",
  "shipping_state": "Bangkok",
  "shipping_postal_code": "10110",
  "shipping_country": "Thailand",
  "payment_method": "cash_on_delivery",
  "notes": "Call before delivery",
  "expected_total": 50000
}
```

Request cancellation with `PATCH /api/orders/{orderId}`:

```json
{ "action": "request_cancellation", "reason": "I selected the wrong model." }
```

Request a return:

```json
{ "action": "request_return", "reason": "The product arrived damaged." }
```

Admin fulfilment update:

```json
{ "status": "confirmed" }
```

Admin request resolution:

```json
{
  "action": "resolve_request",
  "request_type": "cancellation",
  "decision": "approve",
  "admin_note": "Cancellation approved."
}
```

## Main files

- `app/cart/page.tsx` — COD checkout form.
- `app/orders/page.tsx` — customer requests and history.
- `app/admin/page.tsx` — customer purchase management.
- `app/api/orders/` — protected order endpoints.
- `app/lib/backend.ts` — authorization and lifecycle rules.
- `app/lib/supabase.ts` — database adapter.
- `supabase/migrations/2026-07-28-cod-order-lifecycle.sql` — existing database upgrade.
- `CUSTOMER_SETTINGS_FILTERS_RECENT_SETUP.md` — settings, filters, recently
  viewed, and GLTF error-fix instructions.

## Verification

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
