# Wholesale accounts & quantity-tier pricing

This document covers the wholesale/tier-pricing feature: how it works, how to
migrate an existing database, and how to operate it.

## Concepts

Wholesale accounts are **provisioned by an administrator** — there is no
customer-facing application form. A customer registers a normal account, an
admin grants it wholesale access (Admin → Wholesale tab), and the customer
keeps logging in through the same login page as everyone else; the only
difference they see is tier pricing on multi-unit purchases.

| Table | Purpose |
| --- | --- |
| `price_lists` | Named price lists (e.g. "Standard Wholesale"). A wholesale account is assigned to exactly one. Inactive lists fall back to retail. |
| `product_price_tiers` | Per product + price list: `min_quantity`, `unit_price`, active flag, optional effective window. Duplicate minimums per product+list are rejected by a unique constraint. |
| `audit_log` | Who granted/revoked/suspended/reactivated what, price list assignments, and every tier/price-list change (actor, action, target, before/after, timestamp). |
| `profiles.wholesale_status` | `not_applied` → `approved` ⇄ `suspended` (admin-driven only). Only `approved` + an assigned active price list yields wholesale prices. |
| `products.stock_quantity` | Authoritative numeric inventory for checkout. The legacy `stock` text is derived from it by trigger. |

### Pricing rules

- Normal and suspended customers always pay retail.
- An approved wholesale customer uses the tiers of their assigned price list.
- The applied tier is the **active, in-date tier with the highest
  `min_quantity` that is ≤ the line quantity** (quantity 100 qualifies for a
  `min_quantity = 100` tier). Below every tier, retail applies (wholesale
  discounts are optional per tier — documented assumption).
- Discounts are per product line; quantities of different products never
  combine.
- All pricing is computed by `app/lib/pricing.ts` (`priceLine()`), used by the
  cart, product pricing previews, the admin preview, and order creation.
  Nothing the browser sends can influence a price.

### Checkout

`POST /api/orders` authenticates the user, reloads the profile, price list,
tiers and products, recomputes every line server-side, then calls the
`checkout_order()` Postgres function **with the service role** (its EXECUTE is
revoked from `anon`/`authenticated`, so browsers cannot reach it through
PostgREST and can forge neither the user id nor prices). The function runs in
one transaction:

1. verifies the submitted lines exactly match the user's current cart rows,
2. locks each product row `FOR UPDATE` (concurrent checkouts cannot oversell),
3. validates and decrements `stock_quantity`,
4. inserts the order and order items **with a pricing snapshot**
   (`unit_price`, `retail_unit_price`, `price_list_id`, `tier_id`,
   `tier_min_quantity`) so historical orders never change when tiers are
   edited,
5. clears the cart.

Any failure rolls back everything — no partial orders, no lost carts. The
client may send `expected_total` (the total it last displayed); if the
authoritative total differs, the API answers **409** and the UI refreshes the
cart. The old client-driven insert path is gone; the `"Users create own
orders"`/`"Users create own order items"` RLS policies were removed because
they allowed forging orders with arbitrary prices through PostgREST.

## Migrating an existing deployed database

Run **`supabase/migrations/2026-07-15-wholesale-tier-pricing.sql`** once in the
Supabase SQL editor (or `psql`). It is guarded/idempotent and safe to rerun.
`supabase/schema.sql` contains the equivalent full schema for fresh installs.

What the migration does, in order:

1. `profiles`: adds `wholesale_status` (default `not_applied`) and
   `price_list_id`; replaces `handle_new_user()` so public signup can **never**
   pick a role (previously, metadata sent to GoTrue's public signup endpoint
   could self-assign `wholesale`).
2. Creates `price_lists`, `product_price_tiers`, `audit_log` with
   constraints and indexes.
3. Adds `products.stock_quantity` plus the `sync_products_stock` trigger.
4. Adds snapshot columns to `order_items`.
5. **One-time backfill** (idempotent):
   - creates the **"Standard Wholesale"** price list and copies every non-null
     `products.wholesale_price` into a tier with **`min_quantity = 1`**
     (the legacy behavior: the wholesale price applied from quantity 1 —
     raise the minimums per product afterwards as needed);
   - marks existing `role = 'wholesale'` profiles `approved` and assigns them
     to that list, so current wholesale customers keep their pricing;
   - `stock_quantity`: `'In Stock'` → **100** (documented default — adjust per
     product in the admin panel), `'Out of Stock'` → 0.
6. Creates `checkout_order()` (service-role-only EXECUTE).
7. RLS + privilege hardening:
   - price lists/tiers readable only by admins and the approved customer
     assigned to that list — confidential prices are not exposed publicly;
   - audit log is admin-read, service-role-write;
   - `profiles` UPDATE is restricted to the `full_name`/`phone` **columns**
     (previously any user could PATCH their own `role` to `admin` via
     PostgREST!);
   - order/order-item INSERT policies and grants removed (checkout function
     only).

After migration, `products.wholesale_price` is **legacy**: still written by
the Google Sheets sync, shown only in the admin panel, but never used for
pricing and never served to storefront clients. You may null it out once the
sheet no longer carries it.

## Google Sheets sync

- The sync never reads or writes price tiers; manage tiers in the admin
  "Price Lists & Tiers" panel. There is intentionally no tier import format.
- Optional new column **`stock_quantity`** (non-negative integer): when the
  header is present, the value becomes the product's numeric inventory. When
  absent, the sync leaves the stored quantity untouched and only the
  `stock` text applies (via the trigger rules below).
- Trigger rules for the legacy text: quantity change → text derived from it;
  text set to `Out of Stock` → quantity 0; text set to `In Stock` while
  quantity is 0 → quantity 100 (same documented default as the backfill).

## Sessions

Login now stores the Supabase access token in an `HttpOnly`,
`SameSite=Lax`, `Secure`-in-production cookie (`aphrodite_session`; admins
additionally get `aphrodite_admin_session` as before) and tokens are no
longer returned in JSON bodies or stored in localStorage. Legacy
localStorage bearer tokens are still accepted until they expire (~1 h), then
users simply log in again. Server-side, `requireUserFromRequest` validates
the token against Supabase Auth on every request.

## API summary

Customer:
- `GET /api/products`, `GET /api/products/[id]?quantity=N` — viewer-aware:
  wholesale accounts get their tier table and a server-priced quote.
- `GET /api/cart`, `POST /api/orders` — tier pricing applied server-side.

Admin (all behind `requireAdmin`, all mutations audited):
- `GET /api/admin/wholesale/accounts?filter=wholesale&search=` — customer list.
- `PATCH /api/admin/wholesale/accounts/[userId]`
  (`{action: grant|revoke|suspend|reactivate|assign_price_list}`)
- `GET/POST /api/admin/price-lists` · `PATCH /api/admin/price-lists/[id]`
- `GET/POST /api/admin/tiers` · `PATCH/DELETE /api/admin/tiers/[id]`
- `GET /api/admin/pricing-preview?product_id=&quantity=&price_list_id=`
- `GET /api/admin/audit-log`

## Tests

`npm test` (Vitest — added as the project had no test framework; it is the
smallest zero-config TS-native option). Covers tier selection and effective
windows, entitlement per wholesale status, checkout pricing authority
(browser prices ignored, snapshots, inventory rejection, price-drift 409,
no cart clearing on failure), admin authorization (incl. self-grant
prevention), and Zod validation. Concurrency protection (row locks) and RLS
live in the database and are enforced by `checkout_order()` and the policies
in the migration; they require a live database to exercise.
