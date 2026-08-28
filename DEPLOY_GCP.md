# Deploying aphrodite-shop to Google Cloud

Target: **Cloud Run** (managed containers). The repo already has a
`output: "standalone"` Next.js build and a multi-stage `Dockerfile`, which is
exactly Cloud Run's input format, so this is the shortest path.

Supabase stays where it is. Nothing about the database moves to GCP — Cloud Run
only hosts the Next.js server and calls Supabase over HTTPS like it does today.

---

## 0. What had to change first

- **`public/` did not exist.** The Dockerfile does
  `COPY --from=builder /app/public ./public`, and Docker fails a `COPY` whose
  source path is absent — so the image could not build anywhere, locally or on
  Cloud Build. Added `public/.gitkeep`.
- **`cloudbuild.yaml`** (new). See the comment at the top of the file for why
  `gcloud run deploy --source .` is *not* usable here: `NEXT_PUBLIC_*` values are
  inlined into the browser bundle at `next build` time and `--source` cannot pass
  `--build-arg`.
- **`.gcloudignore`** (new) so the source upload stays small.

Two things to know about running this app on more than one instance:

- `app/lib/rate-limit.ts` keeps counters in-process, so the real limit is
  `limit x instance count`. `--max-instances=3` in `cloudbuild.yaml` bounds that.
  Move to a shared store (Upstash/Memorystore) if the limits must be exact.
- There are no Server Actions and no ISR `revalidate` in this app, so none of the
  usual multi-instance Next.js concerns (`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, a
  shared `cacheHandler`) apply. Every page reads Supabase per request.

---

## 1. Install and authenticate the CLI

`gcloud` is not installed on this machine.

```bash
brew install --cask google-cloud-sdk
```

```bash
gcloud init && gcloud auth login
```

## 2. Create the project and turn on billing

```bash
gcloud projects create aphrodite-shop-prod --name="Aphrodite Shop"
```

```bash
gcloud config set project aphrodite-shop-prod
```

Link a billing account (required — Cloud Run will not deploy without one, even
inside the free tier). List yours, then link:

```bash
gcloud billing accounts list
```

```bash
gcloud billing projects link aphrodite-shop-prod --billing-account=BILLING_ACCOUNT_ID
```

## 3. Enable the APIs

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

## 4. Create the image repository

Pick the region closest to your customers and use it everywhere. Update
`_REGION` in `cloudbuild.yaml` if you change it from `asia-southeast1`.

```bash
gcloud artifacts repositories create aphrodite --repository-format=docker --location=asia-southeast1
```

## 5. Move the runtime secrets into Secret Manager

Four values from `.env.local` are server-only and must never become build args
or plain env vars. Run these from the project root — they read the values
straight out of `.env.local` so nothing is retyped or pasted into shell history:

```bash
set -a && . ./.env.local && set +a
```

```bash
printf %s "$SUPABASE_SERVICE_ROLE_KEY" | gcloud secrets create supabase-service-role-key --data-file=-
```

```bash
printf %s "$GOOGLE_SHEETS_CLIENT_EMAIL" | gcloud secrets create sheets-client-email --data-file=-
```

```bash
printf %s "$GOOGLE_SHEETS_PRIVATE_KEY" | gcloud secrets create sheets-private-key --data-file=-
```

```bash
printf %s "$GOOGLE_SHEETS_SPREADSHEET_ID" | gcloud secrets create sheets-spreadsheet-id --data-file=-
```

To rotate one later: `gcloud secrets versions add <name> --data-file=-`. The
service pins `:latest`, so a redeploy picks it up.

## 6. Grant the service accounts their roles

> Every fenced block in this file runs in its **own shell**, so a variable set in
> one block is empty in the next. That is why `PROJECT_NUMBER` is recomputed
> inside each block below rather than exported once. If you see
> `Service account -compute@developer.gserviceaccount.com does not exist`, the
> variable was empty — you are hitting exactly this.

Let the Cloud Run runtime read the secrets. This is the grant that actually
matters: `roles/editor` does not reliably include secret *payload* access, and
without it the service boots and `/api/health` returns 503.

```bash
PROJECT_NUMBER=$(gcloud projects describe aphrodite-shop-prod --format='value(projectNumber)') && for s in supabase-service-role-key sheets-client-email sheets-private-key sheets-spreadsheet-id; do gcloud secrets add-iam-policy-binding "$s" --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" --role=roles/secretmanager.secretAccessor; done
```

Let Cloud Build push images and deploy. `--condition=None` is required: without
it, `gcloud` tries to prompt for an IAM condition and fails non-interactively
with `Policy modification failed`.

```bash
PROJECT_NUMBER=$(gcloud projects describe aphrodite-shop-prod --format='value(projectNumber)') && for role in roles/run.admin roles/iam.serviceAccountUser; do gcloud projects add-iam-policy-binding aphrodite-shop-prod --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" --role="$role" --condition=None; done
```

On a new project the default compute service account usually already holds
`roles/editor`, which covers both of the roles above — granting them explicitly
keeps the deploy working if someone tightens `editor` later.

Verify before moving on:

```bash
PROJECT_NUMBER=$(gcloud projects describe aphrodite-shop-prod --format='value(projectNumber)') && gcloud projects get-iam-policy aphrodite-shop-prod --flatten="bindings[].members" --filter="bindings.members:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" --format='value(bindings.role)'
```

## 7. Deploy

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are passed as
substitutions because Next.js needs them at build time. Both are public values
that already ship to browsers, so this is not a secret leak.

```bash
set -a && . ./.env.local && set +a && gcloud builds submit --config cloudbuild.yaml --substitutions=_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL",_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

First build takes roughly 5–8 minutes (`npm ci` plus `next build`); later ones
are faster from layer cache.

Each image is tagged with `$BUILD_ID` plus `latest`. `$SHORT_SHA` is deliberately
not used: it is only populated when Cloud Build resolves the source from a commit
(a trigger), so a manual `gcloud builds submit` from this directory — which is not
a git repo — leaves it empty and the build fails immediately with
`invalid image name ...:`. To roll back, list the tags and redeploy an older one:

```bash
gcloud artifacts docker tags list asia-southeast1-docker.pkg.dev/aphrodite-shop-prod/aphrodite/aphrodite-shop
```

```bash
gcloud run deploy aphrodite-shop --region=asia-southeast1 --image=asia-southeast1-docker.pkg.dev/aphrodite-shop-prod/aphrodite/aphrodite-shop:OLDER_BUILD_ID
```

## 8. Verify

```bash
SERVICE_URL=$(gcloud run services describe aphrodite-shop --region=asia-southeast1 --format='value(status.url)') && curl -s "$SERVICE_URL/api/health"
```

`{"status":"ok"}` means the container booted and the service-role key reached it.
`{"status":"unavailable"}` (HTTP 503) means the Secret Manager wiring in step 6
did not take. Then check logs:

```bash
gcloud run services logs read aphrodite-shop --region=asia-southeast1 --limit=50
```

Also worth clicking through once deployed: `/admin/login` (exercises `proxy.ts`),
a product page (exercises the Supabase image `remotePatterns` in
`next.config.ts`), and an admin sheet sync.

## 9. Custom domain

> `YOUR_DOMAIN` below is a placeholder — substitute the domain you actually own,
> e.g. `shop.aphrodite.mm`. Do not paste `example.com`: it is an IANA-reserved
> documentation domain that nobody can verify, so Search Console will dead-end.

**If you do not have a domain yet**, buy one before any of this. Budget $10–15/yr
for a `.com` at Porkbun, Cloudflare Registrar, or Namecheap. Watch for three
things: renewal price (cheap `.shop`/`.store` first years often renew at $35+),
WHOIS privacy that should be included free, and auto-renew switched on — an
expired domain takes the shop offline. Cloud Run does not care which registrar
you use; you only need access to its DNS settings.

Cloud Run's built-in domain mapping is the cheapest route — no load balancer, no
monthly fee, managed TLS. It requires proving you own the domain first.

**9a. Verify ownership.** Verify the *apex* domain (`aphrodite.mm`), not the
subdomain — verification covers all subdomains beneath it.

```bash
gcloud domains verify YOUR_APEX_DOMAIN
```

This opens Google Search Console. Choose the **Domain** property type, and it
gives you a `TXT` record to add at your DNS provider (the registrar where you
bought the domain — Namecheap, Cloudflare, GoDaddy, etc.). Add it, wait for DNS
propagation (minutes to an hour), then click **Verify**.

Confirm it took:

```bash
gcloud domains list-user-verified
```

An empty list means verification has not completed — do not proceed until your
domain is listed, or the next command fails with
`The provided domain does not appear to be verified`.

**9b. Create the mapping.**

```bash
gcloud beta run domain-mappings create --service=aphrodite-shop --domain=shop.YOUR_APEX_DOMAIN --region=asia-southeast1
```

This prints the DNS records to add at your registrar — typically a `CNAME` to
`ghs.googlehosted.com` for a subdomain, or four `A` plus four `AAAA` records for
an apex domain. Add them, then watch the certificate provision:

```bash
gcloud beta run domain-mappings describe --domain=shop.YOUR_APEX_DOMAIN --region=asia-southeast1
```

TLS issuance usually takes 15 minutes but can take up to 24 hours. The domain
serves HTTP before the certificate is ready.

**If domain mapping is unavailable in your region**, or you want CDN caching and
WAF rules, the alternative is a global external Application Load Balancer with a
serverless NEG pointing at the service: no domain verification required, roughly
$18/month plus data processing.

## 10. Automatic deploys (optional)

This directory is **not a git repository yet** (`git rev-parse` fails), so there
is nothing for Cloud Build to watch. Once it is pushed to GitHub:

```bash
gcloud builds triggers create github --repo-name=aphrodite-shop --repo-owner=YOUR_GH_USER --branch-pattern="^main$" --build-config=cloudbuild.yaml
```

Set `_SUPABASE_URL` and `_SUPABASE_ANON_KEY` as trigger substitutions so pushes
build with the right client bundle.

---

## Cost estimate

Rates are Cloud Run tier-1 regions (`asia-southeast1`, `us-central1`, etc.).
Verify current numbers at <https://cloud.google.com/products/calculator> —
these are estimates, not quotes.

**The monthly free tier** absorbs most of a small shop: 180,000 vCPU-seconds,
360,000 GiB-seconds, and 2 million requests.

| Scenario | Config | Monthly |
| --- | --- | --- |
| Soft launch / demo | scale-to-zero, ~20k requests | **$0 – 3** |
| Small production | `--min-instances=1`, ~100k requests | **$10 – 14** |
| Busy | `--min-instances=1`, ~1M requests, bursts to 3 instances | **$19 – 25** |

Where the money goes, at 1 vCPU / 512 MiB:

| Item | Rate | Notes |
| --- | --- | --- |
| Active vCPU | ~$0.000024 / vCPU-s | only while a request is in flight |
| Active memory | ~$0.0000025 / GiB-s | same |
| Idle instance (`min-instances=1`) | ~$0.0000025 / vCPU-s | ~$6.50/mo vCPU + ~$3.20/mo memory, billed 24/7 |
| Requests | $0.40 / million | first 2M free |
| Artifact Registry | $0.10 / GB / month | first 0.5 GB free; image is ~200–300 MB |
| Cloud Build | 2,500 default-machine build-minutes free | see the warning below |
| Internet egress | ~$0.12 / GB | product images served from Supabase don't count |
| Secret Manager | $0.06 / secret version / month | 6 versions free — yours are 4, so $0 |
| Cloud Logging | first 50 GiB free | |

**The one line that can surprise you:** `machineType: E2_HIGHCPU_8` in
`cloudbuild.yaml` is *not* free-tier eligible — it bills around $0.016/minute, so
a 6-minute build is ~$0.10 and 30 builds a month is ~$3. Delete that line to fall
back to the default machine and stay inside the 2,500 free build-minutes; builds
get slower, not broken.

### The min-instances decision

`--min-instances=0` (current setting) costs nothing while idle but gives a cold
start of roughly 2–5 seconds for the first visitor after a quiet period — a real
storefront usually wants to avoid that. `--min-instances=1` removes it for about
$10/month. Start at 0 while testing, switch when you take real orders:

```bash
gcloud run services update aphrodite-shop --region=asia-southeast1 --min-instances=1
```

### Cost controls worth setting on day one

```bash
gcloud billing budgets create --billing-account=BILLING_ACCOUNT_ID --display-name="aphrodite-shop" --budget-amount=25USD --threshold-rule=percent=0.5 --threshold-rule=percent=0.9
```

`--max-instances=3` is already in `cloudbuild.yaml` and is the hard ceiling on a
runaway bill from a traffic spike or a scraper.

### Alternatives considered

- **Firebase App Hosting** — also GCP, also Cloud Run underneath, with git-push
  deploys built in. Similar cost, less control over the build; reasonable if you
  would rather not maintain `cloudbuild.yaml`.
- **Compute Engine `e2-small` VM** — ~$13/month fixed, but you own the OS
  patching, TLS renewal, restarts, and log rotation. Cloud Run is cheaper at low
  traffic and less work at every level of traffic.
- **GKE** — control-plane fee alone exceeds this app's entire Cloud Run bill.

---

## Troubleshooting

Failures actually hit while bringing this service up, and what each one means.

**`Service account -compute@developer.gserviceaccount.com does not exist`**
`$PROJECT_NUMBER` was empty. Each fenced block here runs in its own shell, so an
assignment in one block is gone by the next. Use the combined one-liners in step 6.

**`Policy modification failed. For a binding with condition...`**
`gcloud ... add-iam-policy-binding` wants to prompt for an IAM condition and
cannot do so non-interactively. Add `--condition=None`.

**`invalid image name "...aphrodite-shop:": could not parse reference`**
`$SHORT_SHA` expanded to nothing. It is only set for trigger builds resolved from
a commit; this directory is not a git repo. The config uses `$BUILD_ID` instead.
This fails before any step runs.

**`ERROR: (gcloud.run.deploy) Image '...' not found` on the deploy step, even
though the build step succeeded and printed `Successfully tagged`**
The top-level `images:` field pushes only *after every step completes*, so an
in-build deploy step sees an empty registry. Confirm with:

```bash
gcloud artifacts docker images list asia-southeast1-docker.pkg.dev/aphrodite-shop-prod/aphrodite/aphrodite-shop
```

If that lists 0 items after a "successful" build, this is the cause. The config
now runs explicit `push` steps before `deploy` and defines no `images:` field.

**A Cloud Run service exists but has no working revision.** Normal after a failed
first deploy — `gcloud run deploy` creates the service, then fails to create the
revision. The next successful deploy fills it in; nothing to clean up.
