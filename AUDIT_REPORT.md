# Aphrodite Shop — Architecture, Security, Reliability, and Deployment Audit

## 2026-07-30 follow-up audit

Scope: full re-audit of the working tree (all application, test, SQL, Docker, and CI files; `node_modules`, `.next`, `coverage`, `__MACOSX`, and VCS metadata excluded from analysis), with emphasis on the features added after the 2026-07-19 audit: the COD order lifecycle (2026-07-28), live support chat (2026-07-28), and customer settings / recently viewed products (2026-07-29). No secret value was read, printed, or copied; environment variables were inspected by name only.

Note: this working copy is **not a Git repository** (no `.git` directory). Findings reference files and lines only; no commits were made.

### Executive summary (follow-up)

The post-07-19 feature code is well built: the order lifecycle and checkout run through service-role-only SECURITY DEFINER functions that re-verify ownership/admin role in SQL; support chat and recently-viewed tables are service-role-only with authentication and ownership enforced in the route/business layer; customer settings are Zod-validated and column-grant-restricted; DTO redaction of wholesale prices and exact inventory held up everywhere it was checked, including the new endpoints.

Four issues were confirmed and fixed in this pass:

1. **High — vulnerable framework release.** Next.js 16.2.6 carried nine published high-severity advisories (including a middleware/proxy bypass, GHSA-6gpp-xcg3-4w24, directly relevant because `proxy.ts` optimistically gates `/admin`). Upgraded to the patch release 16.2.12 together with `eslint-config-next`; all nine direct advisories are resolved. This also un-breaks the CI `npm audit --audit-level=high` gate for the framework itself (see remaining risks for what still fails).
2. **High — duplicate-order race in `checkout_order()`.** The function validated the caller's cart rows before acquiring any lock, so two concurrent checkout requests for the same account (double click, request retry, two tabs) could both pass validation and both insert an order, deducting inventory twice. Fixed by locking the cart rows (`SELECT … FOR UPDATE`) before validation — the second transaction now blocks and fails with `CART_CHANGED` after the first commits. Shipped as `supabase/migrations/2026-07-30-checkout-concurrency.sql` plus the same change in `supabase/schema.sql`, and a client-side re-entrancy guard in the cart page.
3. **Medium — API error-contract and input gaps in the products routes.** `GET /api/products` and `GET/PATCH/DELETE /api/products/[id]` could return raw 500s: the GETs had no `try/catch`, and a non-numeric `[id]` became `id=eq.NaN` in the PostgREST query. Fixed with `handleRouteError` wrapping and strict id parsing (404 for non-integer ids), with tests.
4. **Medium — NaN pagination caused 500s.** `?limit=abc` / `?offset=abc` on `/api/products` and `/api/orders` survived the min/max clamps as NaN and failed the upstream query. Fixed with a shared `sanitizePagination()` guard, with tests.

Also cleaned up: dead `insertOrder`/`insertOrderItems` exports removed from the data layer (checkout has been RPC-only since 07-19), and `.dockerignore` now excludes `tests`, `coverage`, `__MACOSX`, `.DS_Store`, `.github`, and this report from image build context.

### Commands executed and results (follow-up)

Baseline (before fixes), Node v24.1.0 / npm 11.3.0, dependencies installed with `npm ci`:

| Command | Baseline result | After fixes |
| --- | --- | --- |
| `npm run lint` | Passed; 0 errors, 5 pre-existing `@next/next/no-img-element` warnings | Same (0 errors, 5 warnings) |
| `npm run typecheck` | Passed | Passed |
| `npm test` | Passed: 11 files, 91 tests | Passed: 12 files, 103 tests |
| `npm run build` | Passed; 43 routes/pages | Passed (see below) |
| `npm audit --audit-level=low` | **Failed: 12 high advisories** (9 against `next@16.2.6`, plus dev-only ESLint chain and Next-bundled `postcss`/`sharp`) | Still exits non-zero, but all 9 direct Next.js advisories are resolved; remainder documented under remaining risks |
| `docker compose config` | Passed | Passed |
| `docker compose build` | **NOT VERIFIED** — the Docker daemon is not running on this machine; the build could not be executed | **NOT VERIFIED** (same reason) |

Final verification exit codes after all fixes (2026-07-30): `npm run lint` 0 · `npm run typecheck` 0 · `npm test` 0 (12 files, 103 tests) · `npm run build` 0 (43 routes) · `npm audit --audit-level=low` 1 (residual advisories documented in F-07) · `docker compose config` 0 · `docker compose build` NOT VERIFIED (daemon unavailable).

### Findings (follow-up)

#### F-01 — Next.js 16.2.6 has nine high-severity advisories (High, dependency/security)

- Affected: `package.json` (`next`, `eslint-config-next` pinned 16.2.6).
- Evidence: `npm audit` reported GHSA-6gpp-xcg3-4w24 (middleware/proxy bypass with Turbopack), GHSA-m99w-x7hq-7vfj (DoS via Server Actions), GHSA-89xv-2m56-2m9x and GHSA-p9j2-gv94-2wf4 (SSRF), GHSA-68g3-v927-f742 and GHSA-4633-3j49-mh5q (response-body cache confusion), GHSA-4c39-4ccg-62r3, GHSA-q8wf-6r8g-63ch, GHSA-955p-x3mx-jcvp — all fixed in 16.2.12.
- Impact: the proxy-bypass advisory is directly relevant to this app's `/admin` gating (defense-in-depth only, since real authorization is server-side in every route, but the redirect gate could be skipped); cache-confusion and DoS issues affect any deployment.
- Fix applied: upgraded `next` and `eslint-config-next` to 16.2.12 (patch release on the same minor; no API changes). Lint, typecheck, tests, and production build re-verified.
- Verification: `npm ls next` → 16.2.12; `npm audit --json` shows `next` flagged only transitively via its bundled `postcss`/`sharp` (see F-07).

#### F-02 — Concurrent checkouts could create duplicate orders (High, correctness/inventory)

- Affected: `checkout_order()` in `supabase/schema.sql` and `supabase/migrations/2026-07-28-cod-order-lifecycle.sql`; `app/cart/page.tsx`.
- Evidence: the function counted and compared cart rows *before* taking any row lock; the first `FOR UPDATE` happened on product rows after the order row was already inserted. Under READ COMMITTED, two simultaneous calls for the same user both see the still-present cart rows, both pass the `CART_CHANGED` checks, and both insert orders and deduct stock. The client submit button is disabled while in flight, but Enter-key resubmission, retried requests, or two tabs bypass that.
- Impact: duplicate COD orders and double inventory deduction for one intended purchase.
- Fix applied: `perform 1 from public.cart_items where user_id = p_user_id for update;` before validation (new migration `2026-07-30-checkout-concurrency.sql`, mirrored in `schema.sql`), plus an explicit re-entrancy guard in `handleCheckout`. The blocked second transaction resumes after the first commit, finds the cart deleted, and fails with `CART_CHANGED` (409 to the client) — no duplicate order.
- Verification: **NOT VERIFIED against a live database** (no Supabase connection is available or permitted in this audit). The migration header documents step-by-step two-session SQL verification queries plus a grant check. Unit tests continue to cover the business-layer checkout paths.

#### F-03 — Products routes broke the JSON error contract and 500ed on junk ids (Medium, API correctness)

- Affected: `app/api/products/route.ts` (GET), `app/api/products/[id]/route.ts` (GET/PATCH/DELETE).
- Evidence: the GET handlers had no `try/catch`, so an upstream Supabase failure escaped `handleRouteError` and produced a framework 500 without the `{ "error": … }` shape every other route returns. `Number("abc")` → NaN flowed into `products?id=eq.NaN`, which PostgREST rejects; the resulting generic `Error` also surfaced as a 500.
- Fix applied: all handlers wrapped with `handleRouteError`; new `parseProductIdParam()` (strict `^\d+$`, safe-integer, positive) returns 404 for invalid ids and blocks PostgREST filter-injection shapes like `1&select=*` in the path segment.
- Verification: `tests/api-hardening.test.ts` covers accept/reject cases including injection shapes; lint/typecheck/build pass.

#### F-04 — NaN pagination parameters caused 500s (Medium, API correctness)

- Affected: `app/lib/supabase.ts` (`selectProducts`, `selectProductsService`, `selectOrders`), reachable from `/api/products?limit=abc` and `/api/orders?limit=abc`.
- Evidence: `Math.min(Math.max(1, NaN), 100)` is NaN, so `limit=NaN` reached PostgREST and failed the request.
- Fix applied: shared `sanitizePagination()` — non-finite values fall back to defaults (24 / 0), valid values are floored and clamped to 1–100 / ≥0.
- Verification: unit tests in `tests/api-hardening.test.ts`.

#### F-05 — Dead code: unused `insertOrder`/`insertOrderItems` (Low, maintainability)

- Checkout has been RPC-only since the 07-19 audit; these exports had no callers (verified by search) but still offered a non-transactional order-insert path. Removed.

#### F-06 — `.dockerignore` allowed test/CI/audit files into the build context (Low, hygiene)

- Added `tests`, `coverage`, `__MACOSX`, `.DS_Store`, `.github`, and `AUDIT_REPORT.md`. `.env*` was already excluded (only `.env.example` allowed).

#### F-07 — Remaining `npm audit` highs have no non-breaking fix (Medium, documented — NOT auto-fixed)

Two clusters remain after F-01, and both would require breaking changes that this audit deliberately did not apply (per the no-breaking-upgrades rule; `npm audit fix --force` was not used):

1. **Dev-only ESLint chain**: `brace-expansion`/`minimatch` advisories reachable through `eslint@9` and `eslint-config-next`'s plugins. The offered fix is `eslint@10` (semver-major). These packages never ship to production or run against untrusted input in this project.
2. **Next-bundled `postcss@8.4.31` and `sharp@0.34.5`**: pinned inside `next@16.2.12` itself; npm's only offered "fix" is a nonsensical downgrade to `next@9.3.3`. Exposure is limited: the PostCSS advisories require attacker-influenced CSS/source maps at build time (this build consumes only first-party CSS), and the sharp/libvips CVEs affect image-optimization of untrusted images (this app serves first-party `public/` assets; remote patterns are restricted to the project's own Supabase storage host).

Consequences: `npm audit --audit-level=low` (and the CI gate at `--audit-level=high`) still exit non-zero. Recommended follow-ups, for a maintainer to decide: adopt an ignore-list audit wrapper (e.g. `better-npm-audit`) or scope the CI gate to `--omit=dev` plus documented exceptions; take the `eslint@10` major in a dedicated change; track Next.js releases for updated bundled `postcss`/`sharp`. **Do not** weaken the gate silently and do not run `npm audit fix --force`.

#### F-08 — Working copy contains populated credentials and is not a Git repository (Informational/operational)

- `.env.local` exists and defines `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (names inspected only; values never read). It is correctly excluded by `.gitignore` and `.dockerignore`, but **any archive/copy of this folder made as-is would leak a service-role key** — treat the directory as secret material and rotate the key if the folder has ever been shared.
- The Google Sheets variables are not set in `.env.local`, so product sync will answer "Google Sheets sync is not configured" until they are provided.
- There is no `.git` directory: the project currently has no version control, no history, and no way to review or revert changes. Initializing a repository is strongly recommended (the existing `.gitignore` is already correct).

### Verified controls (follow-up spot checks)

- Support chat: tables are service-role-only with RLS enabled and browser grants revoked; every route authenticates first; customers can only reach their own conversation (`customer_id` bound to the authenticated id); admin inbox/message/status routes all call `requireAdmin()`; message bodies are trimmed, length-capped at both Zod (1000) and SQL CHECK levels; chat POSTs are rate limited.
- Order lifecycle: `request_order_action()` re-verifies ownership in SQL (`where id=… and user_id=…` under `FOR UPDATE`); `resolve_order_action()` re-verifies the actor is an admin in SQL; both are EXECUTE-restricted to `service_role`; state transitions (pending/confirmed → cancel, delivered → return, single pending request, restock on approval, refund flag on returns) are enforced in the function, and admin fulfilment steps are forced into pending→confirmed→shipped→delivered order with a block while a cancellation request is open.
- Customer settings / recently viewed: `requireCustomerAccount()` blocks admins; updates go through a fixed Zod-validated field set (no mass assignment — role/wholesale/price-list fields are not in the payload type and remain column-grant-protected); recently-viewed rows are scoped to the authenticated user's id on every query; password change re-verifies the current password and is rate limited.
- DTO redaction: wholesale price and exact inventory remain admin-only in every new response path (cart lines, wishlist, orders, recently viewed, product detail); wholesale customers receive only their own assigned active price list's tiers.
- Session cookies remain httpOnly, `Secure` in production, `SameSite=Lax`, lifetime matched to the ~1h Supabase access token; tokens never appear in JSON bodies.

### Access-control matrix

Legend: ✔ allowed, ✘ denied (401/403), "own" = restricted to the caller's own records. All mutation routes validate bodies with Zod via the shared 64 KiB streaming JSON parser (400/413/415); all listed routes derive identity server-side from the httpOnly cookie/bearer token, never from client-supplied ids. RL = rate limited.

| Route | Method | Anon | Normal | Wholesale | Admin | Ownership / notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/products` | GET | ✔ public DTO | ✔ public DTO | ✔ + own tiers | ✔ full record | Viewer-aware DTO |
| `/api/products` | POST | ✘ | ✘ | ✘ | ✔ | — |
| `/api/products/[id]` | GET | ✔ public DTO | ✔ | ✔ + own tiers | ✔ full | 404 on invalid id |
| `/api/products/[id]` | PATCH/DELETE | ✘ | ✘ | ✘ | ✔ | Sparse PATCH, empty patch rejected |
| `/api/auth/register` | POST | ✔ (RL 5/min) | — | — | — | Anon-key signup; role never client-settable |
| `/api/auth/login` | POST | ✔ (RL 10/min) | — | — | — | Sets httpOnly cookie(s) |
| `/api/auth/logout` | POST | ✔ | ✔ | ✔ | ✔ | Clears both cookies |
| `/api/auth/me` | GET | ✘ | ✔ own | ✔ own | ✔ own | — |
| `/api/cart`, `/api/cart/[id]` | GET/POST/PATCH/DELETE | ✘ | ✔ own | ✔ own | ✔ own | RLS + `user_id` filter under caller's token |
| `/api/wishlist`, `/api/wishlist/[id]` | GET/POST/DELETE | ✘ | ✔ own | ✔ own | ✔ own | Same |
| `/api/orders` | GET | ✘ | ✔ own | ✔ own | ✔ all | Admin sees all (by design) |
| `/api/orders` | POST | ✘ | ✔ own cart | ✔ own cart | ✔ | Server-priced, service-role RPC, cart-locked |
| `/api/orders/[id]` | GET | ✘ | ✔ own | ✔ own | ✔ any | RLS-backed owner filter |
| `/api/orders/[id]` | PATCH status | ✘ | ✘ (403) | ✘ (403) | ✔ | Sequential transitions enforced |
| `/api/orders/[id]` | PATCH request cancel/return | ✘ | ✔ own | ✔ own | ✔ | Ownership re-checked in SQL |
| `/api/orders/[id]` | PATCH resolve_request | ✘ | ✘ | ✘ | ✔ | Admin re-checked in SQL; audited |
| `/api/chat` | GET/POST | ✘ | ✔ own conv. | ✔ own conv. | ✘ (403 → admin inbox) | POST RL 30/min |
| `/api/admin/support`, `/api/admin/support/[id]` | GET/POST/PATCH | ✘ | ✘ | ✘ | ✔ | POST RL 30/min |
| `/api/settings` | GET/PATCH | ✘ | ✔ own | ✔ own | ✘ (403) | Fixed field set; no role/wholesale fields |
| `/api/settings/password` | PATCH | ✘ | ✔ own (RL) | ✔ own (RL) | ✘ (403) | Current password re-verified |
| `/api/recently-viewed` | GET/POST/DELETE | ✘ | ✔ own | ✔ own | ✘ (403) | Product existence checked |
| `/api/admin/login` | POST | ✔ (RL 8/min) | 403 non-admin | 403 | ✔ | Role from DB, not request |
| `/api/admin/*` (stats, audit-log, price-lists, tiers, wholesale accounts, pricing-preview, sync-products) | all | ✘ | ✘ | ✘ | ✔ | `requireAdmin()` in business layer; mutations audited |
| `/api/health` | GET | ✔ | ✔ | ✔ | ✔ | Config presence only; no secrets |

### Remaining risks and recommendations (follow-up)

Carried over from the 07-19 report and still open (see details there): single-instance in-memory rate limiting (needs a shared store + trusted proxy for multi-instance production); no session refresh/password reset/MFA (M-03); service-role discipline is convention-enforced (M-04); non-atomic audit writes for some admin mutations (M-05); in-Node search and dashboard aggregation scale linearly (M-08); PII retention undocumented (M-10); RLS verified only with mocks — real-database integration tests remain the top testing gap (M-14); accessibility and image/3D weight items (L-03..L-06).

New/updated:

- The `npm audit` gate decision (F-07) needs a maintainer choice; CI currently fails at that step by design rather than being silently weakened.
- The checkout concurrency fix (F-02) must be applied to the real database and verified with the documented two-session test — until then the race remains live in any deployed environment.
- Initialize Git (F-08) and rotate the service-role key if this folder was ever shared.

### Manual actions required

1. **Apply the database migrations to the connected Supabase project** in filename order — per the project's own error mapping, checkout currently answers 503 ("Checkout database setup is incomplete") until at least the 2026-07-28 lifecycle migration is applied, and the wholesale/tier migration was also reported as not yet applied. Then apply `2026-07-30-checkout-concurrency.sql` and run its documented verification queries. Confirm afterwards that fresh installs (`schema.sql`) and migrated installs match.
2. Decide the CI audit-gate policy for the residual advisories (F-07); schedule the `eslint@10` major separately.
3. Initialize version control; verify `.env.local` has never been distributed, and rotate `SUPABASE_SERVICE_ROLE_KEY` if in doubt.
4. Provide the deployment-level controls the repo cannot: HTTPS reverse proxy/load balancer with body/connection limits, shared rate limiting, managed secrets, monitoring/alerts, backups with restore tests.
5. Stand up disposable-Supabase RLS integration tests (M-14) before treating the policy layer as verified.

### Production-readiness verdict (follow-up)

**Conditionally ready — unchanged in kind from 07-19, improved in degree.** The application code, schema, and container are in good shape: server-authoritative pricing, transactional and now concurrency-safe checkout (pending DB apply), consistent authorization, validated inputs, redacted DTOs, security headers, healthchecks, non-root standalone image, and 103 passing tests. It is **not** production-ready until the manual actions above are done — most critically applying the migrations to the real database (checkout is non-functional on the connected project until then), deciding the audit-gate policy, and putting the service behind a proper HTTPS edge with shared rate limiting.

---

## Original audit (2026-07-19)

Audit date: 2026-07-19 
Scope: all tracked and local project files, the reachable three-commit Git history, dependency metadata, build/test tooling, Supabase schema and migration, API routes, frontend pages/components, Docker, and CI configuration. Secret values were deliberately not printed or copied into this report.

## Executive summary

Aphrodite Shop is a Next.js 16 App Router ecommerce application. Browser pages call same-origin Next.js Route Handlers; those handlers use a custom data-access layer over Supabase Auth and PostgREST. Supabase provides authentication, PostgreSQL storage, row-level security (RLS), wholesale price lists, order history, and atomic checkout. A server-only Google service account reads product data from Sheets. The application has separate customer/admin session cookies, optimistic admin-page gating in `proxy.ts`, server-side role checks, and a multi-stage standalone Docker image.

The strongest parts are the server-authoritative checkout calculation, transactional inventory deduction, owner-scoped cart/wishlist/order queries, server-side admin checks, Zod validation on most mutations, sanitized unexpected errors, security headers, strict TypeScript, a lock file, and focused pricing/authorization/checkout tests.

The audit found no committed credential value and no critical issue. The initial review identified five high-risk findings: sensitive product columns escaped the application DTO boundary; public registration used the Supabase service role and force-confirmed email; partial product updates turned omitted fields into `null`; request-abuse controls were spoofable/per-process/unbounded; and JSON requests had no application size boundary. The code-level portions have been remediated and regression-tested. Production readiness still depends on applying the included database migration and providing deployment controls that cannot be implemented inside this repository alone: a trusted HTTPS reverse proxy/load balancer, shared rate limiting, managed secrets, monitoring, backups/restore tests, and real Supabase RLS integration tests.

## Architecture and data flow

```text
Browser (Next.js client pages)
  -> same-origin /api/* Route Handlers
     -> app/lib/backend.ts (business logic, DTOs, authorization calls)
        -> app/lib/supabase.ts (Supabase Auth + PostgREST)
           -> Supabase Auth / PostgreSQL + RLS
        -> app/lib/google-sheets.ts (Google OAuth + Sheets API, admin sync only)

Admin page gate: proxy.ts (cookie-presence redirect only)
Secure boundary: Route Handler -> authenticate() -> fresh auth user/profile -> requireAdmin()/owner scope
Checkout boundary: POST /api/orders -> server pricing -> service-role checkout_order() RPC transaction
```

Runtime ports and network dependencies:

| Direction | Port / protocol | Purpose | Exposure |
| --- | --- | --- | --- |
| Inbound | TCP 3000 / HTTP | Next.js standalone server | Published by Compose as `3000:3000`; should sit behind an HTTPS reverse proxy/load balancer in production. |
| Outbound | TCP 443 / HTTPS | Supabase Auth and PostgREST | Required for authentication and all application data. No direct PostgreSQL port is used. |
| Outbound | TCP 443 / HTTPS | Google OAuth token endpoint and Sheets API | Required only for administrator-triggered product sync. |

No WebSocket/realtime connection, internal microservice port, direct database socket, file upload endpoint, or shell execution path exists in the repository.

## Commands executed (pre-fix baseline)

| Command | Result |
| --- | --- |
| `git status --short` | Clean at audit start. |
| Repository inventory (`rg --files`, `find`, `wc -l`) | Completed; approximately 11,956 source/schema/test lines. |
| Static risky-pattern and environment-variable searches (`rg`) | Completed. |
| Secret-pattern scan of every reachable Git commit (`git rev-list` + `git grep -l`) | No credential-shaped value found; only variable names/usages. |
| `npm run lint` | Passed with four `@next/next/no-img-element` warnings. |
| `npm run typecheck` | Passed. |
| `npm test` | Passed: 4 files, 61 tests. |
| `npm run build` | Passed; 31 routes/pages generated. |
| `npm ls --all` | Completed; platform-optional and extraneous native packages observed. |
| `npm audit --audit-level=low` | Two moderate advisories through Next.js's bundled PostCSS; automated fix is a breaking forced downgrade and was not applied. |
| `npm outdated` | Patch updates available for Next/React/Tailwind/ESLint; major updates available for Node types, ESLint, and TypeScript. |
| `docker compose config --no-interpolate --quiet` | Compose syntax validated. |

The project-required Next.js 16 bundled documentation was reviewed before code changes: Route Handlers, Proxy, authentication, data security, environment variables, CSP, production checklist, deployment, and self-hosting. Line references in the findings below describe the pre-fix baseline unless the fix log states otherwise.

## Findings by severity

### Critical

No critical finding was verified.

### High

#### H-01 — Confidential product fields escape the DTO boundary

- Evidence: `supabase/schema.sql:308-311` permits public reads of every `products` row and `supabase/schema.sql:614` grants table-wide `SELECT` to `anon` and `authenticated`. RLS controls rows, not columns, so the public Supabase URL/key can query `wholesale_price` and exact `stock_quantity` directly. `app/api/chat/route.ts:17-32` also returns raw `Product` objects from `getProducts()`, bypassing `productDTO()`.
- Impact: competitors/customers can obtain confidential legacy wholesale prices and exact inventory. The application-level redaction in `app/lib/backend.ts:110-130` does not protect direct PostgREST access or routes that skip it.
- Recommendation: revoke table-wide product reads from public roles; grant only explicitly public columns; make application public queries use explicit projections; reserve full product reads/mutations for server-side service-role functions after authentication/authorization; pass chat output through `productDTO()`.
- Fix status: **fixed in code and migration**. Public catalog reads use an explicit safe projection, full product access is confined to service-role functions behind server authorization, chat applies the public DTO, and the migration revokes table-wide product reads and grants only public columns. The migration must be applied to the target Supabase database.

#### H-02 — Public signup uses a privileged admin credential and bypasses email verification

- Evidence: `app/api/auth/register/route.ts:31-37` calls `registerUser()`. `app/lib/supabase.ts:297-323` invokes `auth/v1/admin/users` using the service-role default, sets `email_confirm: true`, and accepts a public internet request after only an in-memory limit.
- Impact: compromise or logic regression in a public route has a service-role blast radius; bot-created accounts are marked verified without mailbox ownership; the design requires a high-privilege credential for ordinary signup.
- Recommendation: call Supabase's anonymous `/signup` endpoint with the anon key, respect the project's email-confirmation setting, and give the UI an explicit “check your email” state. Keep the trigger's hard-coded `normal` role.
- Fix status: **fixed**. Registration now uses `/auth/v1/signup` with the anon key, cannot submit a role or `email_confirm`, and shows an email-verification state when Supabase does not issue a session.

#### H-03 — Partial product PATCH writes omitted fields as null

- Evidence: `app/lib/validation.ts:26-27` documents partial updates, but `app/lib/supabase.ts:274-294` maps every missing field to `null`; `updateProduct()` uses that mapper at `app/lib/supabase.ts:547-561`.
- Impact: a valid PATCH containing one field attempts to null required columns, causing failures; optional values are unintentionally cleared. The current admin UI often sends full records, masking the API defect.
- Recommendation: use a dedicated patch mapper that includes only own properties provided by the caller, reject an empty patch, and add regression tests.
- Fix status: **fixed**. The patch mapper emits only supplied properties, the update schema rejects empty objects, and regression tests cover both behaviors.

#### H-04 — Authentication rate limiting is bypassable and its memory is unbounded

- Evidence: `app/lib/rate-limit.ts:18-44` stores buckets forever in a process `Map`; keys trust the first `x-forwarded-for` value at lines 20-23; counters are per process. Docker publishes the app directly and no reverse proxy configuration guarantees that header is overwritten.
- Impact: spoofed headers bypass login/register limits and create arbitrary bucket keys, enabling brute force and process-memory exhaustion. Multiple replicas multiply the effective limit.
- Recommendation: use a shared, bounded rate-limit store keyed by a trusted platform IP plus account identifier; configure a trusted reverse proxy; add expiry cleanup and a hard local cap as defense in depth.
- Fix status: **partially fixed**. The local limiter now expires buckets, enforces a hard 10,000-bucket cap, limits IP key length, and covers chat. A shared limiter and trusted proxy-derived client address remain deployment requirements for multi-instance production.

#### H-05 — No request-size boundary in the supplied self-hosted path

- Evidence: JSON routes call `request.json()` directly (for example `app/api/chat/route.ts:4-7`, `app/api/auth/login/route.ts:14-25`, and `app/api/orders/route.ts:27-30`). `docker-compose.yml:1-15` exposes Next.js directly and supplies no reverse proxy/body limit.
- Impact: unauthenticated clients can force large body buffering/parsing, increasing memory and CPU pressure; authenticated mutation routes have the same issue.
- Recommendation: enforce a small JSON limit in route parsing and reject oversized/unsupported content types with 413/415; deploy a reverse proxy/load balancer with connection, header, body, and rate limits as recommended by the bundled Next.js self-hosting guide.
- Fix status: **partially fixed**. All JSON mutation routes use a shared streaming parser with a 64 KiB limit and explicit 400/413/415 responses. A reverse proxy/load balancer must still enforce connection, header, body, and slow-client limits before traffic reaches Next.js.

### Medium

#### M-01 — CSP permits inline script execution

- Evidence: `next.config.ts:19-35` includes `'unsafe-inline'` in `script-src`; `object-src 'none'` is absent.
- Impact: the CSP provides materially less XSS defense if an injection sink is introduced. React currently escapes rendered product/user content and no `dangerouslySetInnerHTML`/`eval` sink was found.
- Recommendation: evaluate per-request nonces (with the documented static-rendering cost) or experimental SRI; at minimum add `object-src 'none'`. Keep `'unsafe-eval'` development-only.
- Fix status: **partially fixed**. `object-src 'none'` was added; nonce/SRI migration remains because it would change the rendering/caching model.

#### M-02 — External calls have no deadline or cancellation policy

- Evidence: Supabase fetches at `app/lib/supabase.ts:180`, `:215`, and `:243`, plus Google token/sheet fetches at `app/lib/google-sheets.ts:94` and `:280`, set no abort timeout.
- Impact: stalled upstream connections can occupy request/server resources indefinitely and make shutdowns/degradation unpredictable.
- Recommendation: apply explicit deadlines; retry only safe/idempotent reads with bounded jitter; never blindly retry checkout or other mutations.
- Fix status: **fixed for deadlines**. Supabase Auth/PostgREST and Google OAuth/Sheets calls now have 10-second abort deadlines. A bounded read-retry policy remains optional operational work.

#### M-03 — Session refresh, reset, verification UX, MFA, and revocation are incomplete

- Evidence: login stores only the one-hour Supabase access token (`app/api/auth/login/route.ts:34-60`); the refresh token is discarded. No password-reset, email-verification callback, MFA, active-device, or server-side session-revocation flow exists.
- Impact: users are forced out after roughly one hour; stolen access tokens remain usable until expiry; important account recovery/assurance controls are missing.
- Recommendation: use a maintained Supabase SSR/auth integration or a carefully designed refresh-token cookie flow with rotation/reuse detection; add reset, verification, MFA for admins, and logout/revocation behavior.

#### M-04 — Service-role operations rely on route discipline rather than database-enforced caller identity

- Evidence: `selectCustomerProfiles()`, wholesale profile updates, audit writes, product sync, and checkout RPC use the service role (`app/lib/supabase.ts:1004-1083`, `:1115-1136`). Current callers do run `requireAdmin()`/authentication.
- Impact: a future missed guard has full RLS-bypass impact. This is a maintainability risk, not a currently verified authorization bypass.
- Recommendation: isolate all service-role code in a small `server-only` module with capability-specific APIs; pass verified IDs, not arbitrary requests; retain explicit route and business-layer checks and tests.

#### M-05 — Audit records are incomplete and not atomic with mutations

- Evidence: wholesale/tier/price-list mutations write first and audit second in `app/lib/backend.ts:708-1107`; product changes and order-status changes (`:385-404`, `:1114-1121`) are not audited.
- Impact: an audit insert failure can leave an unaudited change; key administrator actions are absent from the log.
- Recommendation: move mutation + audit into transactional database functions and cover all privileged changes.

#### M-06 — Input constraints are inconsistent

- Evidence: shipping name/phone/address have only minimum length (`app/lib/validation.ts:46-54`); product name/category/brand/image lack maximum lengths (`:3-24`); partial schemas accept empty objects; product query filters are not enum/length validated in `app/api/products/route.ts:11-30`.
- Impact: oversized records, poor data quality, unexpected PostgREST errors, and avoidable resource consumption.
- Recommendation: define shared route/query schemas, strict maximums and formats, reject empty patches, and normalize phone/address rules appropriate to supported markets.
- Fix status: **partially fixed**. Empty product patches are rejected and chat text is capped at 500 characters; broader field/query constraints remain.

#### M-07 — Client network failures can become unhandled rejections or permanent loading states

- Evidence: homepage product loading (`app/page.tsx:25-47`) and chatbot submission (`app/components/ChatbotButton.tsx:15-35`) lack `try/catch/finally` and response-status validation; similar pages vary in error handling.
- Impact: transient failures can leave spinners/buttons stuck and produce unhandled promise rejections.
- Recommendation: centralize a typed fetch helper, abort stale searches, consistently validate status/JSON, and expose retryable error UI.

#### M-08 — Catalog search and dashboard aggregates do not scale

- Evidence: searched products fetch the full filtered set then filter in Node (`app/lib/supabase.ts:463-494`); dashboard stats fetch all orders and order items then aggregate in Node (`:765-791`, `app/lib/backend.ts:1148-1230`).
- Impact: response time and memory grow linearly with catalog/order history; endpoints can hit platform timeouts.
- Recommendation: move search and aggregations into indexed SQL/RPC/views; paginate all list APIs.

#### M-09 — Missing database indexes for common ownership/time queries

- Evidence: `orders` is filtered by `user_id` and ordered by `created_at` (`app/lib/supabase.ts:713-731`) but `supabase/schema.sql` defines no matching index; `order_items.order_id` also lacks an explicit index.
- Impact: order history, joins, cascades, and admin reporting degrade as data grows.
- Recommendation: add `orders(user_id, created_at desc)`, `orders(created_at desc)`, and `order_items(order_id)` after validating with query plans.
- Fix status: **fixed in schema/migration**. The indexes are included in both the canonical schema and the dated migration; production query plans should be inspected after applying it.

#### M-10 — PII retention, backup, and deletion behavior are undocumented

- Evidence: orders store shipping name, phone, address, and notes (`supabase/schema.sql:56-69`); deleting an auth user cascades profile then orders (`:3-4`, `:56-58`). No retention, backup, restoration, or legal-record strategy is documented.
- Impact: accidental account deletion can erase transaction records; sensitive delivery data may be retained indefinitely.
- Recommendation: define retention/legal requirements, consider pseudonymization instead of cascading historical orders, enable encrypted backups/PITR, test restores, and minimize admin/API exposure.

#### M-11 — CI omits tests/security checks and receives an unnecessary service secret

- Evidence: `.github/workflows/ci.yml:19-29` runs install/lint/type/build but not `npm test` or an audit; the build step receives `SUPABASE_SERVICE_ROLE_KEY`, although build-time public URL/key are sufficient for this app.
- Impact: regression tests do not gate changes; a privileged credential is unnecessarily exposed to third-party build actions/processes.
- Recommendation: remove the service-role key from build, add tests and a non-breaking audit policy, set minimal workflow permissions, and consider immutable action SHAs/dependency review.
- Fix status: **fixed except immutable action pinning/dependency review**. CI now has read-only contents permission, runs tests and a high-severity audit gate, and no longer receives the service-role key during build.

#### M-12 — Docker lacks health checks and production edge controls

- Evidence: `Dockerfile` is multi-stage/non-root/standalone but has no `HEALTHCHECK`; Compose has no service healthcheck and injects secrets as ordinary environment variables (`docker-compose.yml:8-15`).
- Impact: orchestrators cannot distinguish “running” from “ready”; secrets are visible through container inspection; direct exposure omits TLS, body/rate limits, and slow-client protection.
- Recommendation: add a lightweight health route + Docker/Compose healthcheck; use platform secret mounts/manager; put a production reverse proxy/load balancer in front; document graceful shutdown/rollback.
- Fix status: **partially fixed**. A non-secret readiness endpoint, image/Compose healthchecks, and a 30-second stop grace period were added. Edge controls and managed secret injection remain deployment responsibilities.

#### M-13 — Two moderate production dependency advisories remain

- Evidence: `npm audit --audit-level=low` reports GHSA-qx2v-qp2m-jg93 in `next/node_modules/postcss` (two paths). The offered `npm audit fix --force` would install a breaking old Next.js version.
- Impact: vulnerable CSS stringify behavior could matter if untrusted CSS is ever processed. Current application does not accept CSS input, reducing exploitability.
- Recommendation: do not force-fix; track a patched stable Next.js release, update Next/React together after compatibility testing, and rerun the audit.

#### M-14 — High-risk database security is tested only with mocks

- Evidence: `tests/authorization.test.ts` and `tests/checkout.test.ts` mock the Supabase layer. No test runs policies against PostgreSQL/Supabase roles or directly attempts cross-user CRUD.
- Impact: policy/grant drift can expose data while unit tests remain green.
- Recommendation: add disposable-Supabase integration tests for anon/normal/wholesale/admin/service roles, cross-user cart/wishlist/orders, confidential columns, profile privilege escalation, and checkout RPC execute grants.

### Low

#### L-01 — Very large modules and UI components reduce reviewability

- Evidence: `app/lib/backend.ts` is 1,246 lines, `app/lib/supabase.ts` 1,137, `app/admin/page.tsx` 1,180, and `app/admin/PricingPanel.tsx` 571.
- Impact: authorization/data-shaping mistakes are easier to miss; testing and ownership boundaries are blurred.
- Recommendation: split DAL modules by capability (`auth`, `catalog`, `cart`, `orders`, `admin`, `pricing`) and split admin UI by panel/form/table.

#### L-02 — Dead/legacy code and assets remain

- Evidence: `insertOrder()` and `insertOrderItems()` in `app/lib/supabase.ts:794-826` are unused after atomic RPC checkout; public create-next-app SVGs have no references; legacy localStorage bearer support remains in `app/lib/client-auth.ts`.
- Impact: extra surface and misleading paths make audits harder.
- Recommendation: remove after confirming no supported legacy client depends on them; document a cutoff for bearer migration.

#### L-03 — Accessibility defects are widespread

- Evidence: many labels have no `htmlFor`/input `id` (for example `app/login/page.tsx:82-106`, `app/register/page.tsx:98-136`, `app/cart/page.tsx:366-413`); Navbar search and language selection lack accessible names (`app/components/Navbar.tsx:45-53`, `app/components/LanguageSwitcher.tsx:6-15`); chatbot dialog/focus/status semantics are absent.
- Impact: screen-reader and keyboard users receive ambiguous controls/status; automated lint does not catch every relationship.
- Recommendation: associate every label/control, add names/live regions/dialog focus management, visible focus styles, and automated accessibility tests.

#### L-04 — Motion does not respect user preference

- Evidence: `app/globals.css:16-47` runs an infinite hero animation with no `prefers-reduced-motion` override.
- Impact: discomfort for motion-sensitive users.
- Recommendation: disable or simplify animation under reduced-motion preference.

#### L-05 — Image/3D delivery is heavy

- Evidence: lint reports four raw `<img>` uses; `public/models` is about 14 MB; product cards initialize model-viewer and can fetch models on the catalog (`app/components/Product3DViewer.tsx:23-66`).
- Impact: mobile bandwidth, LCP, battery, and main-thread costs.
- Recommendation: use `next/image` for raster assets, load 3D only on explicit interaction/detail pages, compress/quantize GLB assets, and measure bundles/Core Web Vitals.

#### L-06 — SEO and global error UX are minimal

- Evidence: `app/layout.tsx:4-7` has generic metadata; no sitemap, robots, Open Graph image, route loading UI, or global error UI exists.
- Impact: weaker discoverability/sharing and inconsistent uncaught-error recovery.
- Recommendation: add product-aware metadata, sitemap/robots, and accessible error/loading boundaries.

#### L-07 — Optional native dependencies are host-specific

- Evidence: `package.json` directly lists Darwin ARM packages under `optionalDependencies`; `npm ls --all` shows extraneous native support packages on the audit host.
- Impact: lockfile churn and confusing cross-platform install output.
- Recommendation: let parent packages resolve platform binaries unless a documented reproducibility issue requires pins.

### Informational / verified controls

- I-01: No committed `.env`, PEM/private key, credential-shaped token, `eval`, `dangerouslySetInnerHTML`, child process, command execution, upload handler, unsafe redirect, or explicit permissive CORS configuration was found.
- I-02: `.env.local` is configured and ignored. The placeholder-only `.env.example` is now explicitly allowed by `.gitignore` so clean clones receive the environment contract.
- I-03: Cookie sessions are HttpOnly, Secure in production, SameSite=Lax, path `/`, and limited to the access-token lifetime (`app/api/auth/login/route.ts:41-60`, admin equivalent). All state changes use POST/PATCH/DELETE, so Lax cookies provide meaningful CSRF mitigation. Explicit Origin enforcement would add defense in depth for self-hosting.
- I-04: Normal-user ownership is enforced both in query filters and RLS for cart/wishlist/orders (`app/lib/supabase.ts:576-743`, `supabase/schema.sql:356-425`). No current cross-user read/update/delete path was verified.
- I-05: Role self-escalation is blocked by a trigger that always creates `normal` profiles and column-level profile update grants (`supabase/schema.sql:236-260`, `:616-619`).
- I-06: Checkout recomputes prices server-side, ignores client line prices, verifies cart consistency, locks product rows, deducts inventory, creates order/items, and clears the cart atomically (`app/lib/backend.ts:529-638`, `supabase/schema.sql:483-610`).
- I-07: Docker uses a lockfile install, multi-stage standalone output, a non-root runtime user, and only exposes the required application port.
- I-08: No application-level CORS header is emitted, so browser cross-origin reads are not enabled by this code. Production origin behavior should still be verified at the CDN/reverse proxy and Supabase configuration.

## Testing assessment

Present:

- Unit tests for tier selection and eligibility.
- Business-layer tests for checkout pricing authority, inventory errors, price drift, and atomic RPC payloads.
- Business-layer admin authorization and wholesale/tier behavior tests.
- Validation tests for role smuggling, tiers, inventory, and order price-field stripping.
- Security regression tests for DTO redaction, column grants, partial PATCH mapping, anonymous signup, verification behavior, malformed/oversized JSON, and media-type enforcement.

Highest-priority additions:

1. Real database/RLS/grant integration tests across two normal users plus wholesale/admin roles.
2. Route-level tests proving wholesale price and exact inventory never reach anonymous/normal/chat responses.
3. Rate-limit, timeout, and upstream-failure tests.
4. End-to-end login/cart/checkout/order-ownership/admin tests and accessibility smoke tests.

## Documentation and operations assessment

The create-next-app boilerplate was replaced with project-specific setup, architecture, environment, schema/migration, Google Sheets, test, Docker, deployment, backup, rollback, and troubleshooting documentation. The stale `ADMIN_SETUP.md` token-response statement was corrected, and `.env.example` is trackable. Monitoring/alerting and provider-specific backup/restore execution still require an owned production platform.

No monitoring/telemetry, alerting, deployment target, automated migration pipeline, tested backup/restore process, or SLO is defined. A health endpoint and container healthchecks now exist, and Compose allows a 30-second shutdown grace period.

## Prioritized remediation plan

1. Apply `supabase/migrations/2026-07-19-security-hardening.sql` and verify grants/indexes in the target project.
2. Add real Supabase RLS/grant integration tests before production.
3. Put the service behind a trusted HTTPS reverse proxy/load balancer and shared distributed limiter.
4. Implement refresh/reset/MFA and document OAuth/email callback allowlists.
5. Make privileged mutations and audit writes atomic; move aggregates/search into indexed SQL.
6. Establish managed secrets, monitoring/alerts, encrypted backups, restore exercises, and an automated migration/rollback process.
7. Track the upstream PostCSS advisory and update Next/React when a compatible patched release is available.
8. Address accessibility, client error states, image/3D performance, and SEO.

## Fix log

The audit report was created before application changes. The following remediation was then implemented:

- Catalog confidentiality: explicit public product projections, service-only full product functions, chat DTO redaction, column-level SQL grants, and regression tests.
- Authentication: anonymous Supabase signup, verification-aware UI, and tests proving no public service-role/admin-signup use.
- API correctness and abuse resistance: sparse PATCH mapping, empty-patch rejection, a shared 64 KiB streaming JSON parser, 400/413/415 handling, bounded local rate-limit storage, and chat limiting.
- Reliability: 10-second upstream request deadlines, `/api/health`, Docker/Compose healthchecks, and a 30-second stop grace period.
- Database/CI/operations: ownership/time indexes, dated hardening migration, CI tests and audit gate with reduced secrets/permissions, tracked environment template, and rewritten operational documentation.
- Defense in depth: `object-src 'none'` added to CSP and upstream error bodies removed from Google API logs.

Post-fix verification on 2026-07-19:

| Command | Result |
| --- | --- |
| `npm run lint` | Passed; zero errors and the same four existing raw-image warnings. |
| `npm run typecheck` | Passed when run after the build completed. An earlier parallel invocation transiently observed `.next` route types while the build regenerated them; the build TypeScript phase and the sequential command both passed. |
| `npm test` | Passed: 7 files, 72 tests. |
| `npm run build` | Passed; 31 routes/pages plus `/api/health`. |
| `npm audit --audit-level=low` | Reconfirmed two moderate PostCSS findings nested under Next.js; the only offered automatic fix remains a breaking forced downgrade to Next 9.3.3 and was not applied. |
| Credential/dangerous-code pattern scan (`rg`) | No credential value or dynamic-code execution sink found. Expected PEM marker templates occur in `.env.example` and the Google key parser only. |
| `git diff --check` | Passed. |
| `docker compose config --quiet` | Passed; expected warnings only because audit-shell environment variables were not exported. |

Files changed or added:

- Security/data path: `app/lib/{backend,errors,google-sheets,rate-limit,request,supabase,validation}.ts`, all JSON-consuming Route Handlers under `app/api`, `app/api/health/route.ts`, and `app/register/page.tsx`.
- Database/deployment: `supabase/schema.sql`, `supabase/migrations/2026-07-19-security-hardening.sql`, `Dockerfile`, `docker-compose.yml`, `next.config.ts`, and `.github/workflows/ci.yml`.
- Tests/docs/config: `tests/{checkout,registration,request,security-regressions,validation}.test.ts`, `README.md`, `ADMIN_SETUP.md`, `.env.example`, and `.gitignore`.
