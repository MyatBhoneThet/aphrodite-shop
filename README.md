# Aphrodite Shop

Aphrodite Shop is a Next.js ecommerce application for laptops and accessories. It supports customer accounts, login-gated wishlist/cart/COD purchasing, detailed delivery addresses, cancellation and return requests, server-authoritative pricing, inventory-safe checkout, and administrator purchase management.

For the security and architecture review, see [AUDIT_REPORT.md](./AUDIT_REPORT.md).
For the new customer purchase setup and workflow, see [PURCHASE_FLOW_SETUP.md](./PURCHASE_FLOW_SETUP.md).
For customer settings, catalogue filters, recently viewed products, and the
GLTF texture error fix, see
[CUSTOMER_SETTINGS_FILTERS_RECENT_SETUP.md](./CUSTOMER_SETTINGS_FILTERS_RECENT_SETUP.md).

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

Do not set `NODE_ENV` in `.env.local`; Next.js selects it for `dev`, `build`, and tests. Use separate credentials/projects for development, staging, and production. Google sync expects the production `Laptops`, `Accessories`, and `PC Parts` tabs described in `docs/production-google-sheet-sync.md`.

## Authentication and roles

- Public registration uses Supabase's anonymous signup endpoint and honors the project's email-confirmation setting.
- Anonymous visitors can browse products, but cart, wishlist, checkout, and order history require login.
- Access tokens are stored in `HttpOnly`, `SameSite=Lax`, production-`Secure` cookies for at most one hour.
- `proxy.ts` only performs an optimistic cookie-presence redirect for admin pages. It is not the authorization boundary.
- Every protected API authenticates the token and reloads the profile. Admin mutations call `requireAdmin()` server-side.
- The database trigger always creates a `normal` profile. Wholesale/admin roles cannot be chosen in signup metadata.
- Cart, wishlist, and order ownership is also enforced with Supabase RLS.

The current implementation does not refresh sessions. Password reset, MFA, and a refresh-token flow remain production work; see the audit report.

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

Configure the Google service-account email and private key, share the production Sheet with that email as a viewer, apply the production-sync database migration, and use the admin product panel. The real production spreadsheet ID is built in; `GOOGLE_SHEETS_SPREADSHEET_ID` is only needed to override it. “Dry run” parses, groups, and validates without writing; “Sync” performs a source-key upsert after an authenticated administrator check. Google calls have a thirty-second deadline and external error bodies are not copied to clients/logs.

## Admin setup

See [ADMIN_SETUP.md](./ADMIN_SETUP.md) for creating/granting an administrator and [docs/wholesale-pricing.md](./docs/wholesale-pricing.md) for wholesale rules. Never create an admin through public signup metadata.

## Common problems

- `Supabase is not configured`: verify URL, anon key, and (for checkout/admin) service-role key in the runtime environment.
- Registration succeeds but login fails: email confirmation is enabled; use the verification link first and verify the Supabase Site URL/redirect allowlist.
- Products fail after hardening: apply `supabase/migrations/2026-07-19-security-hardening.sql`; application queries require the matching column grants.
- Google sync is not configured: set the service-account email and private key, then share the Sheet with that service account.
- Google private key error: preserve the PEM markers and either multiline content or escaped `\n` characters.
- Docker health is `unhealthy`: inspect runtime environment injection and request `/api/health`; it returns 503 when core Supabase credentials are missing.
- Build blocks a remote product image: provide the correct Supabase URL at build time so `next.config.ts` can allow its storage hostname.

## Security notes

- Treat every browser field, query parameter, ID, and header as untrusted.
- The anon key is public; RLS, grants, and explicit DTOs protect data. The service-role key must remain server-only.
- JSON request bodies are limited to 64 KiB in application routes. The production proxy should enforce an equal or smaller edge limit where practical.
- Do not log tokens, passwords, private keys, full upstream error bodies, or complete shipping records.
- Run real Supabase role/RLS integration tests before production; the current suite primarily mocks the data adapter.
- Define shipping-data retention/deletion rules and test backups/restores before accepting real orders.
