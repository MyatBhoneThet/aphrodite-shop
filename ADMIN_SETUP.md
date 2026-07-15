# Aphrodite Admin Setup

This project includes an admin area for the Aphrodite laptop and accessories
shop: a dedicated admin login, a business statistics dashboard, and an
AdminLTE-style panel for managing products, orders, and the Google Sheet
sync.

## Admin login

Use the admin account you created in Supabase Authentication (see below for
how to grant the `admin` role to a profile). Do not commit or display real
credentials anywhere in the app UI or documentation.

Open:

```txt
http://localhost:3000/admin/login
```

After login, admins land on:

```txt
http://localhost:3000/admin/dashboard
```

From there, "Manage Products & Orders" links to the product/order/sync panel
at `/admin`.

## Supabase profile requirement

The auth user must exist in Supabase Authentication, and the `profiles` table must have role `admin`.

Run this in Supabase SQL Editor if needed:

```sql
insert into public.profiles (id, email, full_name, role)
select id, email, 'Demo Admin', 'admin'
from auth.users
where email = 'admin@aphrodite.com'
on conflict (id)
do update set
  role = 'admin',
  full_name = 'Demo Admin';
```

Check it:

```sql
select id, email, full_name, role
from public.profiles
where email = 'admin@aphrodite.com';
```

## Required migration: admin profile read policy

The dashboard's "Total Customers" stat counts rows in `profiles`, which only
allows a user to read their own row by default. Run the latest
`supabase/schema.sql` in the Supabase SQL Editor (or just the block below) to
add the `is_admin()` helper and the "Admins read all profiles" policy it
powers:

```sql
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles"
on public.profiles for select
to authenticated
using (public.is_admin());

grant execute on function public.is_admin() to authenticated;
```

Without this, `/admin/dashboard` still loads, but the customer count will
fail (surfaced as a generic "Something went wrong" error, per the app's
error-sanitization policy -- check the server logs, which will show the
underlying RLS permission error).

## How admin auth works

- Passwords are never handled or stored by this app -- `POST /api/admin/login`
  calls Supabase Auth (GoTrue), which stores passwords hashed. We only ever
  hold the short-lived access token Supabase issues after a successful login.
- On success, if (and only if) the account's `profiles.role` is `admin`, the
  server sets an **httpOnly** session cookie (`aphrodite_admin_session`,
  ~1 hour lifetime) and also returns the token in the response body so the
  existing client-side `fetch()` calls throughout `/admin` keep working via
  `Authorization: Bearer` headers (unchanged from the rest of the app).
- `proxy.ts` (Next.js 16 renamed `middleware.ts` to `proxy.ts`) redirects any
  unauthenticated request to `/admin/*` to `/admin/login` **before** any
  admin HTML is sent -- this is an optimistic check (cookie presence only).
  The real authorization check is `requireAdmin()` server-side on every
  `/api/admin/*` request, which is what actually protects the data.
- `POST /api/admin/logout` clears the cookie; the client also clears
  `localStorage`.

## Files added or changed

```txt
proxy.ts                            Server-side /admin/* route gate (Next 16 "proxy", formerly middleware)
app/lib/admin-session.ts            Admin session cookie constant + parser
app/api/admin/login/route.ts        POST /api/admin/login
app/api/admin/logout/route.ts       POST /api/admin/logout
app/api/admin/stats/route.ts        GET /api/admin/stats
app/admin/login/page.tsx            Dedicated admin login page
app/admin/dashboard/page.tsx        Business statistics dashboard
app/admin/page.tsx                  Product/order/sync management panel (unchanged features, dashboard tab removed)
app/lib/backend.ts                  getAdminStats() aggregation
app/lib/supabase.ts                 countProducts/countCustomers/countOrders/selectOrderStats/selectOrderItemStats
supabase/schema.sql                 is_admin() + "Admins read all profiles" policy
app/components/Navbar.tsx           Admin button now links to /admin/dashboard
ADMIN_SETUP.md                      This setup guide
```

## Run locally

```bash
npm install
npm run dev
```

Then visit:

```txt
http://localhost:3000/admin/login
```

## Dashboard features

- Total revenue, orders (+ pending), customers, and products (+ in stock / out of stock)
- Sales trend over the last 6 months
- Orders by status
- Top selling products (by units sold, from order history)
- Recent orders

## Static images note

Your uploaded project used `public1`. I also copied it to `public` so Next.js can serve product images and `.glb` model files correctly at paths like `/products/macbook-air.png` and `/models/macbook-air.glb`.
