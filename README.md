# Aphrodite Shop

Aphrodite Shop is a Next.js ecommerce application for laptops, PC parts, and accessories. It supports category-specific product specifications, a catalogue-based PC Build Planner, customer accounts, login-gated wishlist/cart/COD purchasing, detailed delivery addresses, cancellation and return requests, server-authoritative pricing, inventory-safe checkout, and administrator purchase management.

## Stack and architecture

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4
- Next.js Route Handlers as the browser-facing API
- Supabase Auth plus PostgreSQL/PostgREST and row-level security
- Zod request validation and Vitest tests
- Google OAuth service-account access to the read-only Sheets API
- Multi-stage, non-root Next.js standalone Docker image

The browser calls only same-origin `/api/*` routes. `app/lib/backend.ts` contains business/authorization logic and DTOs; `app/lib/supabase.ts` contains the Supabase data adapter. Public clients never need the Supabase service-role key. Checkout prices are recomputed on the server and committed by the `checkout_order()` database function in one transaction.

## Prerequisites

- Node.js 20 or newer
- npm (use the committed `package-lock.json`)
- A Supabase project
- Docker with Compose, optional
- A Google Cloud service account and Sheet shared with it, optional (only for product sync)

## Local setup

1. Install exact dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env.local` and replace placeholders. Never commit `.env.local`.

3. Apply the database SQL in this order:

   - New database: run `supabase/schema.sql`.
   - Existing database: apply every file in `supabase/migrations/` in filename order.

   The 2026-07-19 security migration is required: it prevents anonymous/authenticated PostgREST callers from selecting the legacy wholesale price and exact inventory columns.
   The 2026-07-28 COD lifecycle migration is required for detailed delivery addresses, payment tracking, cancellation/return requests, and inventory-safe approvals.
   The 2026-07-30 checkout concurrency migration is required: it makes concurrent checkout requests for the same account serialize on the cart rows so a duplicate submission cannot create a second order and deduct inventory twice.
   The `20260822175607_order_receipts_returns_and_admin_cancellation.sql` migration is required for digital receipts, administrator out-of-stock cancellation, the 7-day return window, pickup scheduling, inspection-safe restocking, and refund records.

4. Start development:

   ```bash
   npm run dev
   ```

5. Open <http://localhost:3000>.

## Environment variables

| Variable | Required | Exposure | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes with current Docker config | Public | Supabase project HTTPS URL; also configures the allowed image host. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes with current Docker config | Public by design | Supabase anon/publishable key. Database grants and RLS remain the security boundary. |
| `SUPABASE_URL` | Optional alternative | Server only | Preferred server-side alias for the same project URL. |
| `SUPABASE_ANON_KEY` | Optional alternative | Server only | Preferred server-side alias for the anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for checkout/admin operations | Secret, server only | Runs narrowly scoped service operations that bypass RLS. Never prefix with `NEXT_PUBLIC_`. |
| `GOOGLE_SHEETS_CLIENT_EMAIL` | For Sheets sync | Server only | Google service-account email. |
| `GOOGLE_SHEETS_PRIVATE_KEY` | For Sheets sync | Secret, server only | PEM private key; escaped `\n` is accepted. |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Optional | Server only | Overrides the built-in production inventory spreadsheet ID. |
| `APP_URL` | For email links and Google sign-in | Server only | Public website URL, such as `http://localhost:3000` locally. Also builds the password-reset link and the Google sign-in callback, so it must match the site exactly and be allow-listed in Supabase. |
| `RESEND_API_KEY` | Optional | Secret, server only | Sends the order-confirmation receipt email. The website receipt still works without it. |
| `RECEIPT_FROM_EMAIL` | With Resend | Server only | Verified sender, for example `Aphrodite Myanmar <receipts@example.com>`. |
| `RECEIPT_CURRENCY` | Optional | Server only | Currency used in receipt formatting; defaults to `MMK`. |
| `GEMINI_API_KEY` | Optional | Secret, server only | Turns on AI answers in the storefront **Instant help** assistant. Without it the assistant still works using its free built-in rules. Never prefix with `NEXT_PUBLIC_`. |
| `GEMINI_MODEL` | Optional | Server only | Pins one Gemini model id. Left unset, the server asks Google which models the key can use and picks a `flash` one, so an upstream rename cannot break the assistant. |

Do not set `NODE_ENV` in `.env.local`; Next.js selects it for `dev`, `build`, and tests. Use separate credentials/projects for development, staging, and production. Google sync expects the production `Laptops`, `Accessories`, and `PC Parts` tabs (see Google Sheets product sync below).

## Authentication and roles

- Public registration uses Supabase's anonymous signup endpoint and honors the project's email-confirmation setting.
- **Continue with Google** signs in through Supabase's Google provider using the PKCE flow. The authorization code is exchanged for a token *on the server*, so no access token ever reaches the browser's URL or JavaScript (see Google sign-in below).
- **Forgot password?** emails a single-use link to `/reset-password`, which redeems the token server-side and sets the new password (see Password reset email below). No session is created by the reset: the customer signs in with the password they just chose.
- Anonymous visitors can browse products, but cart, wishlist, checkout, and order history require login.
- Access tokens are stored in `HttpOnly`, `SameSite=Lax`, production-`Secure` cookies for at most one hour.
- `proxy.ts` only performs an optimistic cookie-presence redirect for admin pages. It is not the authorization boundary.
- Every protected API authenticates the token and reloads the profile. Admin mutations call `requireAdmin()` server-side.
- The database trigger always creates a `normal` profile. Wholesale/admin roles cannot be chosen in signup metadata.
- Cart, wishlist, and order ownership is also enforced with Supabase RLS.

The current implementation does not refresh sessions. MFA and a refresh-token flow remain production work; see the audit report.

## Commands

```bash
npm run dev        # development server on port 3000
npm run lint       # ESLint
npm run typecheck  # TypeScript without emitting files
npm test           # Vitest suite
npm run build      # optimized standalone production build
npm start          # run the production Next.js server
npm audit --audit-level=low
```

Before merging, run lint, type checking, tests, build, and the package audit. Two moderate PostCSS advisories may remain through the pinned Next.js version; do not use `npm audit fix --force`, because its proposed remediation is breaking. Update Next/React together to a patched stable release and rerun all checks.

## Docker

Build and run with Compose:

```bash
docker compose build
docker compose up
```

Only TCP port 3000 is published. The container uses Next.js standalone output, runs as a non-root user, and checks `/api/health`. No local database or persistent volume is required because Supabase is managed externally.

Compose passes secrets as environment variables for development convenience. In production, use the platform's secret manager/mounts. Put an HTTPS reverse proxy or managed load balancer in front of port 3000 to enforce TLS, trusted forwarding headers, request/connection limits, shared rate limiting, and slow-client protection. Do not expose the container port directly to the internet.

## Production deployment

1. Provision separate production Supabase and Google credentials.
2. Apply and record database migrations before switching application traffic.
3. Build once and promote the same image through environments.
4. Inject runtime secrets through the deployment secret manager.
5. Route HTTPS traffic through a reverse proxy/load balancer to container port 3000.
6. Require `/api/health` to pass before accepting traffic and allow at least a 30-second termination drain.
7. Use rolling/canary deployment and keep the previous image available for rollback. Database migrations must be backward compatible; restore schema/data from a tested backup rather than attempting destructive rollback.
8. Enable centralized structured logs, error reporting, latency/error-rate alerts, Supabase backups/PITR, and periodic restore tests.

For horizontally scaled self-hosting, replace the in-memory login limiter with a shared store and follow the bundled Next.js self-hosting guidance for deployment IDs, cache coordination, and Server Action encryption keys if Server Actions are added.

## Google Sheets product sync

Configure the Google service-account email and private key, share the APD Sheet with that email, apply the database migrations, and use **Admin → Google Sheet Sync**. The shared spreadsheet ID is built in; `GOOGLE_SHEETS_SPREADSHEET_ID` is only needed to override it. **Dry Run** parses, groups, and validates without writing; **Sync Products** performs a batched source-key upsert after an authenticated administrator check. The storefront loads the complete catalogue in pages and separates laptops, accessories, and PC parts.

## Instant help assistant (optional Gemini)

The storefront chat widget has two tabs: **Instant help** (automatic answers) and
**Live support** (a private conversation with an administrator). Instant help
works with no configuration at all, using the free offline rules in
`app/lib/assistant-rules.ts`.

To upgrade Instant help to AI answers with Google Gemini's free tier:

1. Open <https://aistudio.google.com/app/apikey> and sign in with a Google account.
2. Choose **Create API key**, then copy the key.
3. Add it to `.env.local` (this file is gitignored and must never be committed):

   ```bash
   GEMINI_API_KEY=paste-your-key-here
   ```

4. Stop the dev server and run `npm run dev` again — environment variables are
   only read at startup.

Behaviour and limits:

- The key is read only on the server in `app/lib/gemini.ts`. It is never sent to
  the browser and never written to a log line; the browser only ever calls
  same-origin `/api/assistant`.
- The catalogue is loaded server-side, so a browser cannot tell the assistant
  what the shop sells or what it costs. Product cards shown beside an answer
  always come from real database rows, never from model output.
- The assistant is scoped to shop topics (products, prices, delivery, orders,
  receipts, returns, PC building) and declines anything else.
- If the key is missing, the quota is exhausted, or Google is unreachable, the
  route silently falls back to the built-in rules, and the disclaimer under the
  chat box changes to say the message was not sent to an AI provider.
- Requests are rate limited per IP (`assistant`, 20 per window).

## Signup verification email

The "confirm your email" message is sent by **Supabase Auth**, not by this
application, so its design and its sender live in the Supabase dashboard rather
than in this repository. Two settings, once:

1. **Design** — Supabase → Authentication → Emails → **Confirm signup**. Paste
   `docs/email-templates/supabase-confirm-signup.html` into the message body and
   set the subject to `Confirm your Aphrodite Myanmar account`. Keep the
   `{{ .ConfirmationURL }}` placeholder exactly as it is; Supabase fills it in.

2. **Sender name and address** — Supabase → Project Settings → Authentication →
   **SMTP Settings**. Set *Sender name* to `Aphrodite Myanmar` and *Sender
   email* to your address. To send from a Gmail address you must enable custom
   SMTP (`smtp.gmail.com`, port `465`, your address as the username) and use a
   Google **App Password**, not the normal account password — create it at
   <https://myaccount.google.com/apppasswords> with 2-Step Verification on.
   Without custom SMTP, Supabase sends from its own shared address and is rate
   limited to a few messages per hour, which is fine for testing only.

The contact footer in that template is a copy of `app/lib/email-footer.ts`,
which the order-receipt email imports. Supabase renders its template on its own
servers and cannot import from this codebase, so **if you change one, change the
other**.

## Google sign-in

"Continue with Google" needs no keys in `.env.local`: the credentials live in
Google Cloud and Supabase. Three settings, once:

1. **Google Cloud** → APIs & Services → Credentials → *Create OAuth client ID* →
   **Web application**. Under *Authorised redirect URIs* add the Supabase
   callback, which is your project URL plus `/auth/v1/callback`:

   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```

   Copy the **Client ID** and **Client secret**.

2. **Supabase** → Authentication → Providers → **Google**. Enable it and paste
   the Client ID and secret.

3. **Supabase** → Authentication → **URL Configuration**. Add this app's OAuth
   callback to *Redirect URLs*, once per environment:

   ```
   http://localhost:3000/api/auth/oauth/callback
   https://your-production-domain/api/auth/oauth/callback
   ```

   The address comes from `APP_URL` (not from the incoming request, so a forged
   `Host` header cannot move the callback). If `APP_URL` and this allow-list
   disagree, Google returns the customer to the wrong place and sign-in fails.

How it works: `/api/auth/oauth/google` mints a PKCE verifier, keeps it in a
ten-minute `HttpOnly` cookie, and redirects to Supabase.
`/api/auth/oauth/callback` swaps the returned code for a session using that
verifier and stores the token in the usual session cookie. A first-time Google
user gets a profile from the same `on_auth_user_created` trigger as everyone
else, always with the `normal` role — signing in with Google cannot grant
wholesale or admin access. Business accounts still need the invite-code form,
so the Google button is hidden on the Business tab of `/register`.

## Password reset email

`/forgot-password` sends the link. Which mailer sends it depends on what is
configured:

- **With `GMAIL_USER` + `GMAIL_APP_PASSWORD` (or Resend)** — the app mints the
  token with Supabase's admin API and sends its own branded message from
  `app/lib/password-reset-email.ts`, through the same account as order
  receipts. This is the recommended setup: Supabase's built-in mailer is rate
  limited to a few messages per hour.
- **With no mail configured** — the app falls back to Supabase's own recovery
  email. Paste `docs/email-templates/supabase-reset-password.html` into
  Supabase → Authentication → Emails → **Reset password**, subject
  `Reset your Aphrodite Myanmar password`, and set *Site URL* under URL
  Configuration. That template deliberately links to
  `{{ .SiteURL }}/reset-password?token={{ .TokenHash }}` rather than the default
  `{{ .ConfirmationURL }}`, so both paths land on the same page.

`/api/auth/forgot-password` answers the same way for every address, whether or
not it has an account — otherwise it would reveal which email addresses have
registered with the shop. Check the server log to see what actually happened.

## Admin setup

Create the user in Supabase Authentication, then give the profile the `admin` role in the Supabase SQL Editor:

```sql
insert into public.profiles (id, email, full_name, role)
select id, email, 'Admin', 'admin' from auth.users where email = 'you@example.com'
on conflict (id) do update set role = 'admin';
```

Sign in at `/admin/login`. Never create an admin through public signup metadata.

## Common problems

- `Supabase is not configured`: verify URL, anon key, and (for checkout/admin) service-role key in the runtime environment.
- Registration succeeds but login fails: email confirmation is enabled; use the verification link first and verify the Supabase Site URL/redirect allowlist.
- Products fail after hardening: apply `supabase/migrations/2026-07-19-security-hardening.sql`; application queries require the matching column grants.
- Google sync is not configured: set the service-account email and private key, then share the Sheet with that service account.
- Google private key error: preserve the PEM markers and either multiline content or escaped `\n` characters.
- Docker health is `unhealthy`: inspect runtime environment injection and request `/api/health`; it returns 503 when core Supabase credentials are missing.
- Build blocks a remote product image: provide the correct Supabase URL at build time so `next.config.ts` can allow its storage hostname.
- `next: command not found`: run `npm ci` in the project folder before `npm run dev`.
- Turbopack panic mentioning `binding to a port`: this package already uses Webpack in both `dev` and `build`. Run only `npm run dev`; do not append another `--webpack`.
- Google sign-in returns "This sign-in link has expired": the PKCE verifier cookie was missing — the sign-in took over ten minutes, or it started in a different browser. Start again from `/login`.
- Google sign-in fails with a redirect error: `APP_URL` and the Supabase *Redirect URLs* allow-list must contain the same `/api/auth/oauth/callback` address.
- The reset email never arrives: check the server log for `[auth.forgot-password]`. `User with this email not found` means no account uses that address; a mail error names the provider problem. The page says the same thing either way, by design.
- Receipt email says `not_configured`: add `RESEND_API_KEY`, a verified `RECEIPT_FROM_EMAIL`, and `APP_URL`, then restart the application. The customer can still print or save the website receipt.

## Security notes

- Treat every browser field, query parameter, ID, and header as untrusted.
- The anon key is public; RLS, grants, and explicit DTOs protect data. The service-role key must remain server-only.
- JSON request bodies are limited to 64 KiB in application routes. The production proxy should enforce an equal or smaller edge limit where practical.
- Do not log tokens, passwords, private keys, full upstream error bodies, or complete shipping records.
- Run real Supabase role/RLS integration tests before production; the current suite primarily mocks the data adapter.
- Define shipping-data retention/deletion rules and test backups/restores before accepting real orders.

## Product promotions

The inventory tabs in the connected Google Sheet support three optional columns:

| Column | Value |
| --- | --- |
| Promo Price MMK | Whole-number sale price, greater than zero and below Retail Price MMK. Blank disables the offer. |
| Promo Start | Optional `YYYY-MM-DD HH:mm` in Myanmar time (UTC+06:30). Blank starts immediately after sync. |
| Promo End | Optional `YYYY-MM-DD HH:mm` in Myanmar time. The offer stops at this exact instant; blank means no expiry. |

In the current workbook these columns are **AJ:AL on Laptops** and **AZ:BB on Accessories and PC Parts**, with headers on row 6. The List tab contains category lookup values, not products. Keep the regular price unchanged. For example, regular price `2000000` and promo price `1500000` show **−25% MMK 1,500,000**, with **MMK 2,000,000** crossed out underneath. No promotions are activated by adding blank columns.

Use Admin → Sync Products (or the existing automatic sync) after editing the sheet. Scheduled dates are stored with the product and evaluated when pricing is requested, so expiry does not depend on another sheet sync. Product detail quotes refresh every 30 seconds while open; checkout always recalculates and asks the shopper to review a changed total. All date inputs, including native Sheets date cells, are interpreted as Myanmar wall-clock time regardless of the workbook timezone. Use explicit dates rather than timezone-dependent `NOW()` formulas.

The offer applies separately to each product/spec variant. Repeated inventory rows for the **same** product/version must have identical regular and promotion prices and dates; conflicting offers are disabled for that product. Invalid dates, fractional prices, reversed date ranges, and prices at or above regular retail disable the offer without removing the product.

For approved wholesale accounts, the lower of the promotion and the qualifying wholesale tier wins. Discounts do not stack, and wholesale percentage bands still use the regular retail price. The cart, checkout, and saved order lines use the authoritative server quote; receipts retain the price charged even after a promotion ends. Promotion metadata is stored in `products.full_specs.promotion` through the existing sheet sync, so no database migration is required.
