# Aphrodite Admin Dashboard Setup

This project now includes an AdminLTE-style admin page for the Aphrodite laptop and accessories shop.

## Admin login

Use your Supabase admin account:

```txt
Email: admin@aphrodite.com
Password: Admin123456
```

Open:

```txt
http://localhost:3000/login
```

After login, admin users are redirected to:

```txt
http://localhost:3000/admin
```

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

## Files added or changed

```txt
app/admin/page.tsx              New AdminLTE-style dashboard
app/login/page.tsx              Admin login redirect to /admin
app/components/Navbar.tsx       Shows Admin button when role is admin
ADMIN_SETUP.md                  This setup guide
```

## Run locally

```bash
npm install
npm run dev
```

Then visit:

```txt
http://localhost:3000/login
```

## Dashboard features

- AdminLTE-style dark sidebar and top bar
- Sales, order, product, and stock cards
- Sales graph and order status graph
- Product management: add, edit, delete
- Order management: view orders and update status
- Google Sheet product sync page

## Static images note

Your uploaded project used `public1`. I also copied it to `public` so Next.js can serve product images and `.glb` model files correctly at paths like `/products/macbook-air.png` and `/models/macbook-air.glb`.
