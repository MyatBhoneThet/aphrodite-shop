# Customer Settings, Product Filters, and Recently Viewed Setup

This update adds account settings for normal and wholesale customers, complete
catalogue filtering, account-based recently viewed products, saved cash-on-
delivery addresses, and a fix for the GLTF texture errors shown by Next.js.

## 1. Replace the project

The safest option is to use the complete project folder supplied with this
update. Keep your existing `.env.local`; it contains the connection to your
Supabase project and is intentionally not included in the ZIP.

If you copy individual files, copy every file listed under **Files changed**
below. The screen code and database/API code depend on each other.

## 2. Install packages

Open a terminal in the project folder and run:

```bash
npm ci
```

## 3. Apply the database migration

Saving a SQL file in `supabase/migrations` does not change the online Supabase
database. The migration must be run once in the Supabase dashboard:

1. Open `supabase/migrations/2026-07-29-customer-settings-recently-viewed.sql`.
2. Copy the complete file.
3. Open your Supabase project.
4. Select **SQL Editor → New query**.
5. Paste the SQL and select **Run**.
6. Wait for `Success. No rows returned`.

The migration adds customer delivery/preferences fields to `profiles` and
creates a private `recently_viewed_products` table.

Verify it with:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in (
    'shipping_address_line1',
    'shipping_country',
    'preferred_language',
    'order_updates_enabled',
    'support_updates_enabled',
    'marketing_emails_enabled'
  )
order by column_name;

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'recently_viewed_products';
```

## 4. Start the website

```bash
npm run dev
```

Open `http://localhost:3000`.

If the server was already running while files were replaced, stop it with
Control+C, run `npm run dev` again, and hard-refresh the browser.

## 5. Test customer settings

1. Register or log in as a normal or wholesale customer.
2. Select **Settings** in the top navigation.
3. Update the full name, phone, delivery address, language, and communication
   preferences.
4. Select **Save account settings**.
5. Open the cart. The COD recipient, phone, and delivery address are filled
   automatically from the saved account.
6. Test **Change password** with the current password and a new password of at
   least eight characters.

Wholesale customers use the same settings page. Their approved wholesale badge
and assigned price-list name are displayed, but customers cannot change their
own role, approval status, or price list. Those remain administrator-controlled.

## 6. Test product filters

1. Open the main store.
2. Select **Filter products** below the category cards.
3. Enter a minimum and/or maximum price.
4. Optionally select product type, stock status, brand, and sorting.
5. The Laptop and Accessories sections update together.
6. Select **Clear all filters** to reset the catalogue.

The homepage requests up to 100 matching products, rather than the previous
default first 24, so the filter covers the full current catalogue.

## 7. Test recently viewed

1. Log in as a customer.
2. Open two or more product detail pages.
3. Return to the main store.
4. A **Recently viewed** section appears after **Accessories**.
5. Select the small **Recently viewed** button in the bottom-right corner to
   scroll to that section.
6. Select **Clear history** to remove the current account's history.

The history belongs to the authenticated account. A different customer cannot
read it, and an administrator account cannot use customer history endpoints.
Anonymous visitors can browse product details, but their views are not stored.

## Why the GLTFLoader error happened

The screenshot showed:

```text
THREE.GLTFLoader: Couldn't load texture "blob:http://localhost:3000/..."
```

Every product card was starting a `<model-viewer>` instance, even though cards
were non-interactive. During development re-rendering, model instances could be
disconnected while GLTFLoader was still reading an embedded texture. The
temporary `blob:` texture URL was then revoked and Next.js displayed one error
for each failed card—the **4 Issues** badge in the screenshot.

The fix is:

- Catalogue and recently viewed cards use stable product poster images.
- The interactive 3D model remains on the product detail page only.
- The detail viewer catches model import/load failures and falls back to its
  poster image.

After replacing the files, restart Next.js and hard-refresh. Old red overlays
from the previous development session do not disappear until the page reloads.

## Files changed

### Customer account settings

- `app/settings/page.tsx`
- `app/api/settings/route.ts`
- `app/api/settings/password/route.ts`
- `app/lib/useCurrentUser.ts`
- `app/cart/page.tsx`
- `app/components/Navbar.tsx`

### Filters and recently viewed

- `app/components/ProductFilters.tsx`
- `app/components/RecentlyViewedSection.tsx`
- `app/lib/product-filters.ts`
- `app/page.tsx`
- `app/products/[id]/page.tsx`
- `app/api/recently-viewed/route.ts`

### Server, validation, and database

- `app/lib/backend.ts`
- `app/lib/supabase.ts`
- `app/lib/validation.ts`
- `supabase/schema.sql`
- `supabase/migrations/2026-07-29-customer-settings-recently-viewed.sql`

### 3D error fix

- `app/components/ProductCard.tsx`
- `app/components/Product3DViewer.tsx`

### Tests

- `tests/customer-settings-recent.test.ts`
- `tests/product-filters.test.ts`

## Troubleshooting

### “Customer settings database setup is incomplete”

Run the complete `2026-07-29-customer-settings-recently-viewed.sql` migration in
the Supabase SQL Editor. Copying the file into the project is not enough.

### Settings save returns 401

Log out, log in again, and retry. Authentication sessions currently expire
after one hour.

### Recently viewed does not appear

- Confirm the customer is logged in.
- Open a product detail page; looking at a homepage card alone is not recorded.
- Run the migration and refresh the homepage.
- Check that `.env.local` points to the same Supabase project where the
  migration was applied.

### The old GLTF error remains

1. Stop the development server.
2. Delete only the generated `.next` folder.
3. Run `npm run dev`.
4. Hard-refresh the page.

Do not delete the source project, `public/models`, or `.env.local`.

## Verification commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

This completed project passes TypeScript, all 91 automated tests, ESLint with no
errors, and the production build.
