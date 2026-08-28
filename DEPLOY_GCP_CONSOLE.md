# Deploying aphrodite-shop via the GCP web console

Console-driven version of [DEPLOY_GCP.md](DEPLOY_GCP.md). Same destination
(Cloud Run), no `gcloud` commands.

Console labels shift over time; if a button name here does not match exactly,
look for the nearest equivalent on the same page.

---

## The one thing the console cannot do

**Cloud Build cannot see your laptop.** Every console build path — Cloud Run's
"Continuously deploy from a repository", Cloud Build's triggers — builds from a
*connected source repository*. There is no "upload a folder and build it" button.
`gcloud builds submit` was uploading a tarball from your disk, and the console has
no equivalent.

This directory is not a git repository yet, so **Part A is mandatory** before any
console deployment can happen. It is GUI-only; no `git` typing required.

If you would rather avoid GitHub entirely, the honest options are to keep using
`gcloud builds submit`, or to use **Cloud Shell** (the `>_` icon in the console
top bar) — a browser terminal, which is still a CLI in spirit.

---

## Already done

You completed these over the CLI; skip them and verify in passing.

| Step | State |
| --- | --- |
| Project `aphrodite-shop-prod` (number `672175800144`) | created |
| Billing linked | enabled |
| APIs: Run, Cloud Build, Artifact Registry, Secret Manager | enabled |
| Artifact Registry repo `aphrodite` in `asia-southeast1` | created, **0 images** |
| 4 secrets in Secret Manager | created |
| IAM on compute SA (`editor`, `run.admin`, `iam.serviceAccountUser`, per-secret `secretAccessor`) | granted |
| Cloud Run service `aphrodite-shop` | exists, **no working revision** |

So you are starting at Part A, then jumping to Part C (the trigger). Parts B1–B3
are verification only.

---

## Part A — Put the code on GitHub (GUI only)

1. Install **GitHub Desktop** from <https://desktop.github.com> and sign in.
2. **File → Add Local Repository**, choose
   `/Users/myatbhonethet/Desktop/aphrodite-shop`. It will say the folder is not a
   repository and offer **"create a repository"** — click that.
3. On the create screen, leave the name as `aphrodite-shop`. Do **not** let it
   overwrite `.gitignore` — the repo already has one that excludes `.env.local`.
4. Before the first commit, look at the file list in the **Changes** tab and
   confirm **`.env.local` is not listed**. If it appears, stop and fix
   `.gitignore` first — that file holds your service-role key and Sheets private
   key, and pushing it to GitHub publishes them.
5. Enter a summary, click **Commit to main**, then **Publish repository**.
6. On the publish dialog, **keep "Keep this code private" checked**.

`.next/`, `node_modules/`, and `.env*` are already excluded by `.gitignore`
(verified: the `.env*` rule is present, so your keys stay local).

One file to confirm *is* included: **`public/.gitkeep`**. The Dockerfile does
`COPY --from=builder /app/public ./public`, and Docker fails a `COPY` whose source
does not exist. That empty directory is why the build works at all — if it does
not reach GitHub, Cloud Build fails the same way the very first local build did.
Git does not track empty directories, which is exactly what `.gitkeep` is for.

---

## Part B — Verify the groundwork in the console

### B1. Artifact Registry

**Console → Artifact Registry → Repositories.** You should see `aphrodite`,
format Docker, region `asia-southeast1`, and **0 images**. Empty is expected —
the earlier build never pushed.

### B2. Secret Manager

**Console → Security → Secret Manager.** Four secrets:
`supabase-service-role-key`, `sheets-client-email`, `sheets-private-key`,
`sheets-spreadsheet-id`.

To confirm permissions on one: click it → **Permissions** tab → the principal
`672175800144-compute@developer.gserviceaccount.com` should hold
**Secret Manager Secret Accessor**. If a secret is missing that, click
**Grant Access**, paste the principal, pick that role, **Save**.

### B3. IAM

**Console → IAM & Admin → IAM.** Check **"Include Google-provided role grants"**
at the top right, or the compute service account will be hidden. The row for
`672175800144-compute@developer.gserviceaccount.com` should show *Editor*,
*Cloud Run Admin*, and *Service Account User*.

---

## Part C — Build and deploy from the console

This uses the existing [cloudbuild.yaml](cloudbuild.yaml), which already encodes
every fix from the CLI attempts: `$BUILD_ID` tagging, explicit `push` steps before
`deploy`, and the `NEXT_PUBLIC_*` build args.

> **Why not Cloud Run's simpler "Deploy from repository" button?** That path lets
> you choose a Dockerfile but gives you no field for Docker **build args**.
> `next.config.ts` reads the Supabase URL at build time to compute
> `images.remotePatterns`; with no build arg it computes an empty list, and
> `next/image` on `/compare` then rejects every Supabase image URL at runtime. The
> Cloud Build trigger below has a substitutions UI, so it does not have this hole.

### C1. Connect the repository

1. **Console → Cloud Build → Triggers.** Set **Region** to `asia-southeast1`.
2. **Connect Repository → GitHub (Cloud Build GitHub App)**.
3. Authenticate, install the app on your GitHub account, tick `aphrodite-shop`,
   accept the connection.

### C2. Create the trigger

**Create Trigger**, then:

| Field | Value |
| --- | --- |
| Name | `aphrodite-shop-deploy` |
| Event | **Push to a branch** |
| Source repository | `aphrodite-shop` |
| Branch | `^main$` |
| Configuration → Type | **Cloud Build configuration file (yaml or json)** |
| Location | `Repository`, file `cloudbuild.yaml` |
| Service account | `672175800144-compute@developer.gserviceaccount.com` |

Then expand **Advanced → Substitution variables** and **Add variable** twice.
Both values are in your local `.env.local`:

| Variable | Value |
| --- | --- |
| `_SUPABASE_URL` | the `NEXT_PUBLIC_SUPABASE_URL` value |
| `_SUPABASE_ANON_KEY` | the `NEXT_PUBLIC_SUPABASE_ANON_KEY` value |

The anon key is safe here — it is designed to be publicly visible and is
protected by Supabase row-level security. **Never** put the service-role key or
the Sheets private key in a substitution; those stay in Secret Manager and are
mounted at runtime by the deploy step.

**Create**.

### C3. Run it

On the Triggers list, click **Run** on `aphrodite-shop-deploy`, then **Run
trigger**. Follow it in **Cloud Build → History** — click the running build to
stream logs.

Expect four steps: `build`, `push`, `push-latest`, `deploy`. First run is 5–8
minutes, dominated by `npm ci` and `next build`.

---

## Part D — Verify

1. **Console → Cloud Run → `aphrodite-shop`.** The **Revisions** tab should show
   a revision with a green check serving 100% of traffic.
2. Open the service URL: `https://aphrodite-shop-672175800144.asia-southeast1.run.app`
3. Append `/api/health`. `{"status":"ok"}` means the container booted *and* read
   the service-role key from Secret Manager. `{"status":"unavailable"}` (503)
   means the secret wiring failed — recheck B2.
4. **Logs** tab for container startup errors.
5. Click through `/admin/login` (exercises `proxy.ts`), a product page, and
   `/compare` (exercises the Supabase image `remotePatterns`).

To confirm the secrets landed: **Cloud Run → service → Edit & Deploy New Revision
→ Variables & Secrets**. Four secret references, no plaintext keys.

---

## Part E — Production settings

### Custom domain

Use the domain you actually own. `example.com` is IANA-reserved for documentation
and can never be verified.

1. **Verify ownership first**, at <https://search.google.com/search-console>.
   Add a **Domain** property for your *apex* domain (`aphrodite.mm`, not
   `shop.aphrodite.mm`) — verifying the apex covers every subdomain. Search
   Console gives you a `TXT` record; add it at your registrar's DNS page and
   click **Verify**. Propagation takes minutes to an hour.
2. **Console → Cloud Run → Manage Custom Domains → Add Mapping.** Pick
   `aphrodite-shop`, enter the subdomain, and it will show the DNS records to
   add — usually a `CNAME` to `ghs.googlehosted.com`.
3. Add those records at your registrar. TLS is provisioned automatically, usually
   within 15 minutes, occasionally up to 24 hours.

Skipping step 1 produces `The provided domain does not appear to be verified`.

No load balancer and no monthly fee. If mapping is unavailable in your region, or
you want CDN caching and WAF rules, use a global external Application Load
Balancer with a serverless NEG instead (~$18/month, no verification needed).

### Remove cold starts

**Cloud Run → service → Edit & Deploy New Revision → Revision autoscaling →
Minimum number of instances → `1`**. Costs roughly $10/month and eliminates the
2–5 second first-visit delay. Leave it at `0` while testing.

`Maximum number of instances` is already `3` from the config — that is both your
bill ceiling and what keeps the in-memory rate limiter in
`app/lib/rate-limit.ts` meaningful, since its counters are per-process.

### Budget alert

**Console → Billing → Budgets & alerts → Create Budget.** Scope to
`aphrodite-shop-prod`, amount `$25`, alerts at 50% and 90%. This only emails you;
it does not cap spend. `Maximum number of instances` is the actual cap.

---

## After this, deploys are automatic

The trigger fires on every push to `main`. In GitHub Desktop: commit, **Push
origin**, and watch Cloud Build → History. No console visit needed.

Cost estimates and the full rate table are in
[DEPLOY_GCP.md](DEPLOY_GCP.md#cost-estimate); nothing about them changes between
the CLI and console paths.
