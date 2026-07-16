# Admin and wholesale testing guide

This guide verifies the admin dashboard, the admin-provisioned wholesale
account lifecycle, quantity-tier pricing, checkout price integrity, and
role-based access.

## 1. Prerequisites

1. Install dependencies with `npm install`.
2. Configure `.env.local` with the Supabase and application variables used by
   the project.
3. Apply `supabase/migrations/2026-07-15-wholesale-tier-pricing.sql` to the test
   Supabase database. It is idempotent and can be rerun.
4. Prepare three test users:
   - an admin (`profiles.role = 'admin'`),
   - a normal customer who has not applied for wholesale access,
   - a second normal customer for rejection and suspension tests.
5. Have at least one product with positive `stock_quantity` and a known retail
   price.
6. Start the app with `npm run dev` and open <http://localhost:3000>.

Use a test database. Approval, suspension, inventory, orders, and audit entries
are real database changes.

## 2. Automated regression checks

Run these commands before manual testing:

```bash
npm test
npm run lint
npm run build
```

The Vitest suite covers authorization, account grant/revoke, tier selection,
effective dates, validation, server-authoritative checkout pricing, price drift,
inventory failures, cart behavior, and order pricing snapshots. The production
build includes Next.js's TypeScript validation.

If `npm run typecheck` alone reports syntax errors inside
`.next/dev/types/validator.ts` while `npm run build` succeeds, stop the dev
server, remove the generated `.next` directory, restart the server, and rerun
the command. Do not edit generated validator files.

## 3. Admin access

1. Visit `/admin` and `/admin/dashboard` while logged out. Confirm access is
   denied and an admin-login link is shown.
2. Sign in at `/admin/login` with a normal customer. Confirm the admin session
   is rejected and the dashboard is unavailable.
3. Sign in with the admin user. Confirm `/admin/dashboard` and `/admin` load.
4. Confirm product inventory and admin-only product fields are visible.
5. Log out. Confirm protected admin pages are no longer accessible.

Expected: customer sessions never grant admin access. Refreshing a protected
page must not briefly expose protected data from its APIs.

## 4. Wholesale account lifecycle (admin-provisioned)

There is no customer application form: wholesale access is granted directly
by an administrator, and the customer logs in the same way as a normal
customer.

### Grant

1. As the first normal customer, browse a product and cart at quantities
   above a configured tier. Expected: retail pricing only.
2. In a separate browser profile, sign in as admin and open `/admin`.
3. Select **Wholesale**, search for the customer's email, choose an active
   price list, and click **Grant wholesale**.
4. Return to the customer session, log in again (or refresh), and check the
   navbar badge, the product tier table, and the cart.

Expected: the account role is wholesale with the chosen price list assigned,
tier prices apply at qualifying quantities, and the audit trail contains the
grant.

### Suspend and reactivate

1. Suspend the wholesale account from the admin Wholesale panel.
2. Refresh the customer session and check a product and the cart.
3. Reactivate the account as admin and refresh again.

Expected: suspension immediately restores retail pricing; reactivation restores
the assigned active price list. Both actions appear in the audit trail.

### Revoke

1. Revoke wholesale access from the admin Wholesale panel (confirm the prompt).
2. Refresh the customer session.

Expected: the account is a normal retail account again (no badge, no tier
table, retail prices), and the revocation is audited. Granting again restores
wholesale access.

## 5. Price lists and tiers

1. In `/admin`, select **Price Lists & Tiers**.
2. Create an active list named `QA Wholesale`.
3. For one product, add tiers such as:

| Minimum quantity | Unit price |
| ---: | ---: |
| 10 | below retail |
| 50 | below the 10-unit price |
| 100 | below the 50-unit price |

4. Assign `QA Wholesale` to the approved test customer.
5. Use the admin pricing preview at quantities 9, 10, 49, 50, 99, and 100.

Expected:

| Quantity | Applied price |
| ---: | --- |
| 9 | Retail |
| 10-49 | 10+ tier |
| 50-99 | 50+ tier |
| 100+ | 100+ tier |

6. Deactivate the 50+ tier and verify quantity 50 uses the 10+ tier.
7. Reactivate it and verify the 50+ tier returns.
8. Try to create a duplicate minimum for the same product and list.
9. Deactivate the entire price list and refresh the customer product/cart view.

Expected: duplicates are rejected; inactive tiers are ignored; an inactive
assigned list falls back to retail. Tier and list mutations are audited.

## 6. Storefront and checkout

1. As the approved wholesale customer, open the tiered product.
2. Confirm the tier table is visible and quantities below the first tier show
   retail pricing.
3. Add quantities exactly below, at, and above tier boundaries to the cart.
4. Confirm each cart line uses its own quantity; quantities from different
   products are not combined.
5. Place an order at a qualifying quantity.
6. Confirm the order uses the server-calculated price, stock decreases, the
   cart clears, and the order retains its tier/retail pricing snapshot.
7. Change the tier after ordering and confirm the historical order price does
   not change.
8. Put more units in the cart than available stock and attempt checkout.

Expected: insufficient stock fails without creating a partial order or clearing
the cart.

## 7. Security checks

Use the browser Network panel for these checks:

1. As a normal customer, call an admin endpoint such as
   `GET /api/admin/price-lists`. Expect `403`.
2. As a logged-out user, call a protected admin endpoint. Expect `401`.
3. Inspect normal-customer responses from `/api/products` and `/api/cart`.
   Confirm wholesale prices, price-list IDs, tier IDs, and numeric inventory are
   not leaked where the DTO does not explicitly expose them.
4. Modify a checkout request's displayed/expected price in the browser. Confirm
   the server recomputes the price; a stale expected total returns `409`.
5. Attempt to submit `role` or `wholesale_status` with a registration or
   profile request. Confirm they are ignored or rejected and no privilege
   changes occur.
6. As a normal customer, call
   `PATCH /api/admin/wholesale/accounts/<own-user-id>` with
   `{"action":"grant"}`. Expect `403` — customers cannot grant themselves
   wholesale access, and an admin cannot grant it to their own account either.

## 8. Completion checklist

- Automated tests pass.
- Lint has no errors.
- Production build passes.
- Logged-out and normal users cannot access admin APIs or pages.
- Normal and suspended customers receive retail prices.
- Approved customers receive only their assigned active list's effective tiers.
- Boundary quantities choose the highest qualifying tier.
- Checkout recomputes prices and inventory atomically.
- Admin mutations appear in the audit trail.
- Historical orders retain their original pricing snapshots.
