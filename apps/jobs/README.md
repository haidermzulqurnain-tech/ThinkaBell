# @thinkabell/jobs

Background job runners for scheduled price tracking and alert notification dispatching.

Every job is invoked over HTTP by the schedulers below — there is no separate
job-runner process to deploy. Each acquires a PostgreSQL advisory lock for its
duration, so overlapping invocations exit immediately rather than running
concurrently, and each records a row in `job_runs`.

## Jobs Included

1. **`fetch-prices`**:
   - Queries tracked products from Supabase (Amazon ASIN or eBay EPID).
   - Concurrency-controlled via `p-limit` (10 concurrent requests).
   - Fetches live prices from Amazon PA-API 5.0 and eBay Browse API.
   - Detects price changes, updates product record, and inserts price history.
   - Deduplicates alerts via Upstash Redis (24-hour key TTL) and enqueues price drops (>= 5%) to `alert_queue`.
   - Proactively triggers `send-alerts` upon new drops.

2. **`send-alerts`**:
   - Reads pending alerts from `alert_queue`.
   - Filters subscribers by category preferences and minimum discount thresholds.
   - Dispatches browser push notifications via OneSignal REST API.
   - Dispatches price drop email notifications via Brevo API.
   - Marks alerts as `sent = true` in Supabase.

3. **`product-discovery`**:
   - Populates the `products` table from the enabled discovery sources.
   - Configured with `DISCOVERY_SOURCES` — see `docs/AMAZON_LIST_CURATION.md` for the `amazon-list` source and its regional partner tags.

## Schedules

All three jobs run on the same cadence: **every 6 hours (`0 */6 * * *`)**.
The cadence is declared in two places, which must agree:

- `vercel.json` — the `crons` array, used when the app is deployed to **Vercel**
- `packages/database/migrations/0001_cron_schedule.sql` — the `pg_cron` jobs,
  used when the app is deployed to **Hostinger**

Hostinger does not run Vercel's `crons` array, so on that deployment only the
`pg_cron` jobs fire. Apply them with `pnpm db:apply`, then set the two
settings rows and re-run `public.schedule_thinkabell_crons()` — the full
walkthrough is `docs/HOSTINGER_DEPLOYMENT.md` Step 6.5.

## API Endpoints

All are `POST` and require the `Authorization: Bearer <CRON_SECRET>` header,
with a fail-closed per-IP rate limit (10 requests / 60 s). Vercel Cron and the
`pg_cron` jobs both send `POST`, so the method is the same in both
deployments. A `401` means the `CRON_SECRET` in the scheduler and in the app
environment have drifted apart.

- `POST /api/cron/product-discovery` — populate products from discovery sources
- `POST /api/cron/fetch-prices` — refresh prices and enqueue drops
- `POST /api/cron/send-alerts` — dispatch pending alerts

## Local Development

```bash
# In apps/jobs
pnpm dev
```

## Production Deployment

Invoked by Vercel Cron (`vercel.json`) or Supabase `pg_cron`
(`migrations/0001_cron_schedule.sql`). This package is not a serverless
function in either case — the endpoints in `apps/web` call the runners in this
package over HTTP, so no separate deployment is required.
