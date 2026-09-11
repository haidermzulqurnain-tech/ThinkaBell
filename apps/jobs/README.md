# @thinkabell/jobs (Trigger.dev v3)

Background cron jobs for scheduled price tracking and alert notification dispatching.

## Jobs Included

1. **`fetch-prices`**:
   - Schedule: Every 15 minutes (`*/15 * * * *`)
   - Queries tracked products from Supabase (Amazon ASIN or eBay EPID).
   - Concurrency-controlled via `p-limit` (10 concurrent requests).
   - Fetches live prices from Amazon PA-API 5.0 and eBay Browse API.
   - Detects price changes, updates product record, and inserts price history.
   - Deduplicates alerts via Upstash Redis (24-hour key TTL) and enqueues price drops (>= 5%) to `alert_queue`.
   - Proactively triggers `send-alerts` upon new drops.

2. **`send-alerts`**:
   - Schedule: Every 5 minutes (`*/5 * * * *`) or triggered immediately by `fetch-prices`.
   - Reads pending alerts from `alert_queue`.
   - Filters subscribers by category preferences and minimum discount thresholds.
   - Dispatches browser push notifications via OneSignal REST API.
   - Dispatches price drop email notifications via MailerLite API.
   - Marks alerts as `sent = true` in Supabase.

## Local Development

```bash
# In apps/jobs
npx trigger.dev@latest dev
```

## Production Deployment

```bash
# In apps/jobs
npx trigger.dev@latest deploy
```
