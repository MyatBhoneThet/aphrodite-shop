# Aphrodite Shop — preliminary client budget

Prepared 20 September 2026. Currency: USD. Excludes taxes, foreign-exchange charges, and payment-provider fees. This is a planning estimate, not a fixed-price offer or a performance guarantee. Vendor prices were checked against official sources; allowances and labour figures are estimates.

## Recommended budget

Allow **$2,000 once for production launch**, **$200/month for cloud and services**, and **$250/month for technical maintenance**. First-year budget: **$7,400**, excluding any separately agreed fee for development already completed. Cloud charges should be billed to client-owned accounts at actual cost; the $200 is a reserve, not a vendor subscription or guaranteed maximum.

## Scope and assumptions

The existing project includes a Next.js storefront, Supabase database/authentication/file storage, customer accounts, wholesale pricing, Google Sheets inventory sync, checkout, COD and manual prepaid-payment verification, receipt emails, delivery tracking, returns/refunds, live support, and optional Gemini assistance.

Budget assumes approximately 10,000 visits and 300 orders per month, 1,000–3,000 catalogue items, under 20 GB of initial stored files, one production application instance, and one small staging environment. These are planning inputs, not measured usage. Traffic bursts, page weight, chat activity, upload retention and query efficiency can matter more than order count. Reforecast after the first 30 days of production use.

## Monthly cloud and service estimate

| Item | Monthly allowance | Basis |
|---|---:|---|
| Always-on application server | $25 | Render 1 CPU / 2 GB starting configuration; validate under load |
| Hosting workspace | $25 | Render Pro workspace, separate from compute |
| Database, authentication and file storage | $25 | Supabase Pro with one Micro project |
| Transactional email | $20 | Resend Pro, 50,000 emails/month |
| Optional AI assistant | $10 | Usage allowance; pin a model and enforce an application quota |
| Monitoring and external file backups | $15 | Planning allowance; exact services selected during setup |
| Small staging environment | $20 | Allowance for a small application instance and additional database project |
| Domain renewal, annualized | $2 | $24/year allowance; actual price depends on domain and registrar |
| **Subtotal** | **$162** | |
| Usage and price contingency | $38 | Bandwidth, builds, storage and other metered usage |
| **Recommended cloud budget** | **$200/month** | **$2,400/year** |

Render bills workspace and compute separately. Current published compute pricing lists 1 CPU / 2 GB at $25/month, and Pro workspace pricing is $25/month. These are starting prices; bandwidth/build usage can add charges. [Render pricing](https://render.com/pricing), [Render cost model](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses).

Supabase Pro starts at $25/month, with compute credits covering one Micro project. Its included allowances cover 8 GB database disk, 100 GB file storage, and daily database backups retained for seven days; additional projects and usage cost extra. [Supabase pricing](https://supabase.com/pricing).

Resend Pro is $20/month for 50,000 transactional emails. Its free plan has a 100-email daily limit, which can constrain signups, password resets and order notifications during busy periods. Configure authentication mail as well as order mail. [Resend pricing](https://resend.com/pricing).

Google Sheets API usage has no additional API charge; Workspace subscriptions, if wanted, are separate. The existing rules-based assistant can run without Gemini charges; paid AI use depends on the selected model and token consumption. [Sheets usage limits](https://developers.google.com/workspace/sheets/api/limits), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing).

## One-time production launch

These estimates assume the existing implementation is retained. They are proposed labour allowances at **$25/hour**, not a market-rate claim or a record of hours already worked.

| Work | Hours | Estimated cost |
|---|---:|---:|
| Hosting, domain, HTTPS, deployment and secret configuration | 8–12 | $200–300 |
| Production database migrations, storage policies, authentication and email configuration | 10–16 | $250–400 |
| End-to-end checkout/payment/return testing and launch fixes | 20–32 | $500–800 |
| Monitoring, backup automation, restore exercise and load checks | 10–16 | $250–400 |
| Administrator training and handover documentation | 6–10 | $150–250 |
| **Total** | **54–86** | **$1,350–2,150** |

Suggested planning allowance: **$2,000**. Confirm the final scope after production-readiness testing. Major architectural changes or substantial defects require a revised estimate.

## Maintenance and development fees

Allow **$150–300/month** for 6–12 hours at $25/hour; the recommended budget uses **$250/month for 10 hours**. Cover dependency updates, minor fixes, incident investigation, backup checks and routine deployment work. Agree business-hour response expectations. New features, unlimited support, store operations and 24/7 on-call coverage are separate.

If this proposal also needs to price the software development itself, a provisional commercial allowance is **$5,000–10,000**, based on 200–400 equivalent hours at $25/hour for the existing feature scope. This is an illustrative pricing model, not an audit of historical effort or a formal valuation. Replace it with your agreed development fee. Keep launch tasks separate to avoid charging twice for the same work.

| Budget scenario | First year |
|---|---:|
| Cloud only | $2,400 |
| Launch + cloud + maintenance | $2,000 + $2,400 + $3,000 = **$7,400** |
| Above plus illustrative development fee | **$12,400–17,400** |

## Items that can change the estimate

- The application uses timed inventory sync and supports uploads up to 25 MB. An always-on container matches that design; deployment must verify proxy upload limits. A serverless deployment would need its scheduling and upload paths reviewed.
- Live support polls every four seconds while active. Many simultaneous conversations can increase application and database load. Product imagery is currently served without Next.js image optimization, so page weight also affects bandwidth.
- Daily database backups do not include stored product photos, payment slips or return evidence. External file backup is included as an allowance and must be implemented and tested. Daily recovery may still lose recent orders; tighter recovery requires a separate design and budget. [Supabase backup coverage](https://supabase.com/docs/guides/platform/backups).
- Supabase point-in-time recovery starts at $100/month and can require additional compute spend. It is excluded from the $200 baseline. [Supabase pricing](https://supabase.com/pricing).
- The repository documentation flags authentication/session and production integration testing work. The launch allowance includes investigation and ordinary fixes; this estimate is not a completed security or readiness audit.
- The map implementation uses public OpenStreetMap tiles. A contracted map service, if required for traffic or service guarantees, is additional. No paid Google Maps subscription is assumed.
- Payment handling currently includes manual payment-slip verification. Bank, wallet, merchant, settlement, COD collection and courier fees depend on the client's providers. Budget them as transaction volume × contracted rate, plus fixed charges. Automated gateway integration is separate development work.
- Domain allowance assumes an ordinary non-premium domain. Branded staff mailboxes, SMS/OTP, marketing email, advertising, product photography, inventory entry, legal/accounting services, delivery operations and customer-support staffing are excluded.
- This baseline is a single application instance; it does not promise high availability or 24/7 incident response. Sustained growth or availability requirements require a revised architecture and cost estimate.

## Suggested wording for the client

“The estimated production-launch budget for Aphrodite Shop is USD 2,000. Allow USD 200 per month for hosting and supporting cloud services and USD 250 per month for technical maintenance, for a first-year operating and launch budget of USD 7,400. Software development fees, taxes, payment processing and delivery charges are separate. Cloud costs are usage-based and will be reviewed after the first month of operation.”
