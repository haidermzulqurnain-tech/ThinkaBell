# ThinkaBell Official Launch & Operations Playbook

This operational playbook details the pre-launch checklist, content marketing templates, social media syndication, and post-launch maintenance routines for **thinkabell.click**.

---

## 1. Pre-Launch Verification Checklist

- [x] **Supabase Database Initialized**:
  - [x] Apply `packages/database/schema.sql` — scripted: `SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" pnpm db:apply` (idempotent, safe to re-run), or paste it into the Supabase SQL editor.
  - [x] `pnpm db:apply` also runs every not-yet-applied file in `packages/database/migrations/`, tracked in `public.schema_migrations` — currently the cron schedule. This is what keeps the cron jobs in version control.
  - [x] Verify tables: `products`, `price_history`, `subscribers`, `alert_queue`, `retailer_links`, `click_tracking`, `alert_dead_letter`, `job_runs`.
  - [x] Confirm Row Level Security (RLS) is active on all tables.
  - [x] Confirm `subscribers.email_hash` exists with unique index `idx_subscribers_email_hash` (blind index for PII lookups; re-run `schema.sql` on existing databases to add it).
  - [x] Run `pnpm tsx scripts/seed-50-products.ts` or run `packages/database/seed.sql` to populate 50 starter deals. **Note:** both seed **synthetic placeholder data** (randomized ASINs/ePIDs, static prices) for local pipeline testing only — replace with real curated products (`docs/AMAZON_LIST_CURATION.md`) before any public launch. Seeding requires `SUPABASE_SERVICE_ROLE_KEY` (products RLS is anon read-only).
- [ ] **PII Keys Configured (production)**:
  - [ ] Generate `ENCRYPTION_KEY` and `BLIND_INDEX_KEY` (`openssl rand -hex 32` — two different values) and set them as Hostinger environment variables. Until set, PII is stored in plaintext with lower-case lookup indexes (dev fallback).
- [ ] **Supabase Credentials Configured (production)**:
  - [ ] Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and the `NEXT_PUBLIC_` equivalents in Hostinger's Environment section. Real values only — a placeholder is a syntactically valid URL, so it passes a presence check while pointing the client at a host that does not exist. The values are shape-validated; `/api/health` reports any rejected variable by name under `config`.
  - [ ] The two `NEXT_PUBLIC_*` values must also be present at **build** time, since Next.js inlines them into the browser bundle.
- [ ] **DNS & Cloudflare Configured**:
  - [ ] Domain `thinkabell.click` pointed to Cloudflare nameservers.
  - [ ] SSL/TLS set to **Full (strict)**.
  - [ ] Page Rule enabled for caching HTML (Cache Everything, 5 min TTL).
  - [ ] Brotli and Always Online toggled ON.
- [x] **Hostinger Deployment Tested**:
  - [ ] Application running on Node 22.
  - [ ] Application type `Other`; **package manager `pnpm`** (not the npm default — npm does not read `pnpm-workspace.yaml` and the build fails with `next: command not found`); build command `pnpm run build:standalone`; entry file `apps/web/hostinger-server.js`; root directory `./`; output directory empty.
  - [ ] The pnpm _version_ is pinned in `packageManager` (currently `pnpm@10.34.6`), and `pnpm-workspace.yaml` sets `pmOnFail: warn` plus `verifyDepsBeforeRun: warn`, so a host running a different pnpm logs the mismatch and continues instead of aborting the build. The preflight `scripts/verify-build-env.js` treats a version mismatch as advisory; only the wrong package manager or a missing install is fatal.
  - [ ] Health check responds `200 OK` at `https://thinkabell.click/api/health`, with `config: "ok"` and `database: "ok"`.
- [x] **Cron Jobs Active (Hostinger: Supabase `pg_cron`)**:
  - [x] `vercel.json` defines the three cron jobs for `/api/cron/product-discovery`, `/api/cron/fetch-prices`, and `/api/cron/send-alerts` (all `0 */6 * * *`) — used when deployed to Vercel.
  - [x] `packages/database/migrations/0001_cron_schedule.sql` defines the same three as `pg_cron` jobs, which is what actually fires on Hostinger (Vercel's `crons` array is inert there). Applied by `pnpm db:apply`.
  - [ ] `pg_cron` and `pg_net` extensions enabled in Supabase (Dashboard → Database → Extensions).
  - [ ] `public.cron_settings` rows inserted for `site_url` (the public origin) and `cron_secret` (must equal the app's `CRON_SECRET`), then `select public.schedule_thinkabell_crons();` re-run.
  - [ ] Confirm `/api/cron/fetch-prices` and `/api/cron/send-alerts` return `200 OK` with a valid `CRON_SECRET` bearer token, and that `cron.job_run_details` records a result.
- [x] **OneSignal & Brevo Configured**:
  - [ ] OneSignal App ID added for Web Push permissions.
  - [ ] Brevo API key configured for email alert delivery.
- [x] **Product Discovery Configured**:
  - [ ] Set `DISCOVERY_SOURCES` environment variable in `apps/jobs/.env` with desired sources and queries.
  - [ ] Configure API credentials for enabled sources (`EBAY_*`, `WALMART_API_KEY`, `PARTNERSTACK_API_KEY`, `IMPACT_ACCOUNT_SID`, `IMPACT_AUTH_TOKEN`). The `appsumo` source needs no credentials — it harvests AppSumo's public browse and product pages.
  - [ ] For the `amazon-list` source: set `AMAZON_LIST_URLS` to a JSON array of `{ url, marketplace }` entries pointing at public Amazon List URLs you curate, and set the matching regional partner tags (`AMAZON_PARTNER_TAG`, `AMAZON_PARTNER_TAG_UK`, `AMAZON_PARTNER_TAG_DE`, `AMAZON_PARTNER_TAG_CA`). No Amazon login credentials are used or stored — see `docs/AMAZON_LIST_CURATION.md`.
  - [ ] Verify `productDiscoveryRunner` completes successfully and populates `products` table with discovered items.
  - [ ] Confirm `source`, `source_id`, `images`, `video_url`, and `affiliate_links` are populated correctly.

---

## 2. Brevo Welcome Sequence Template

When a new subscriber signs up via `https://thinkabell.click/subscribe`, automate the following 2-part welcome email sequence via Brevo:

### Email 1: Welcome & Deal Confirmation (Immediate)

- **Subject**: Welcome to ThinkaBell! Your deal alerts are now live 🔔
- **Preview Text**: We scan hardware and software prices 24/7 so you never overpay.
- **Body**:
  > Hey there,
  >
  > Welcome to ThinkaBell! You've successfully activated automated deal tracking.
  >
  > Whenever a monitored AI gadget, developer laptop, or SaaS tool drops in price by at least 10%, our spiders flag it and ping your inbox with a verified discount link.
  >
  > **What to do next:**
  >
  > 1. Whitelist our email address so alerts never land in spam.
  > 2. [Browse today's top price drops on ThinkaBell](https://thinkabell.click)
  >
  > Happy saving!  
  > _The ThinkaBell Team_

### Email 2: Set Preferences & Community (Day 3)

- **Subject**: Quick question: Are you looking for hardware or software deals?
- **Body**:
  > Did you know you can customize your alert preferences?
  >
  > If you only care about Mac software or only want notifications for drops above 25%, you can update your thresholds anytime:
  > [Manage My Deal Preferences](https://thinkabell.click/subscribe)

---

## 3. Social Media Deal Syndication Strategy

Automate or manually syndicate verified price drops to social channels:

### X (Twitter) Deal Post Format

```text
🔥 PRICE DROP ALERT: [Product Name]

Regular: $[Old Price]
Deal Price: $[New Price] ([Discount]% OFF!)

Lowest tracked price in 30 days.

👉 Grab deal: https://thinkabell.click/deal/[slug]

#TechDeals #SmartHome #AI #GadgetDeals
```

### Reddit (r/deals, r/buildapcsales, r/macapps)

Format posts with price in brackets, clean non-promotional tone, and link to the price history comparison page on ThinkaBell.

---

## 4. Search Engine Optimization (SEO)

1. **Google Search Console**:
   - Add property `https://thinkabell.click`.
   - Submit sitemap: `https://thinkabell.click/sitemap.xml`.
2. **Schema.org Structured Data**:
   - Validate deal pages using [Google Rich Results Test](https://search.google.com/test/rich-results).
   - Ensure `Product` and `Offer` structured data shows no errors.
3. **Robots.txt**:
   - Verify `apps/web/public/robots.txt` is deployed with correct crawl rules.

---

## 5. Ongoing Maintenance & Operations

1. **Alert Queue Purging**:
   - `alert_queue` records older than 90 days are automatically archived via data retention jobs.
2. **Price History Archival**:
   - `price_history` records older than 2 years are automatically archived.
3. **Click Tracking Cleanup**:
   - `click_tracking` records older than 1 year are automatically archived.
4. **Dead Letter Queue Cleanup**:
   - `dead_letter_queue` records older than 30 days are automatically archived.
5. **Rate Limit Audits**:
   - Monitor Amazon PA-API usage (stay under 1 request/second).
   - Monitor eBay Browse API calls (stay under 5,000 calls/day free tier).
6. **Job Monitoring**:
   - Monitor `job_runs` table for failed or partial executions.
   - `monitorJobRuns` job sends email alerts on failures.

### Product Discovery Automation

1. **Configure Sources**:
   - Set `DISCOVERY_SOURCES` environment variable in `apps/jobs/.env`:
     ```json
     [
       {
         "name": "ebay",
         "type": "physical",
         "queries": ["AI gadgets", "smart home"],
         "enabled": true
       },
       {
         "name": "partnerstack",
         "type": "software",
         "queries": ["productivity", "developer tools"],
         "enabled": true
       }
     ]
     ```
     The `amazon-list` source requires no API credentials — curate public
     Amazon List URLs, set `AMAZON_LIST_URLS` and the regional partner
     tags (`AMAZON_PARTNER_TAG`, `AMAZON_PARTNER_TAG_UK`, `AMAZON_PARTNER_TAG_DE`,
     `AMAZON_PARTNER_TAG_CA`), then add
     `{"name": "amazon-list", "type": "physical", "queries": [], "enabled": true}`.
     Affiliate links fail closed (are skipped) until a partner tag is
     configured. See `docs/AMAZON_LIST_CURATION.md`.
2. **Verify Discovery Job**:
   - Trigger discovery via `POST /api/cron/product-discovery` with the `CRON_SECRET` bearer token, or call `runProductDiscovery()` from `@thinkabell/jobs` directly. On a schedule, both schedulers fire it every 6 hours — Vercel Cron via `vercel.json`, and on Hostinger the `pg_cron` job (see the Cron section above).
   - Check `job_runs` table for successful completion.
   - Verify `products` table has new entries with `source`, `source_id`, `images`, and `affiliate_links` populated.
3. **Monitor Media Enrichment**:
   - Ensure `images` TEXT[] array contains multiple image URLs per product.
   - Verify `metadata` JSONB stores source-specific fields (seller, condition, shipping, etc.).
   - Confirm `affiliate_links` JSONB contains source-specific affiliate URLs.

---

## 6. Environment Setup Commands

### Initial Setup

```bash
# 1. Clone repository
git clone <repository-url> && cd thinkabellclick

# 2. Install dependencies (must use pnpm — npm cannot resolve workspace:* deps)
corepack enable pnpm
pnpm install

# 3. Copy environment files (empty placeholders — fill in real values)
cp .env.example apps/web/.env.local
cp .env.example apps/jobs/.env

# 4. Verify the deployment would actually work, before deploying
pnpm run check:supabase   # stage-by-stage Supabase connectivity
pnpm verify:hostinger     # standalone bundle + entrypoint + env variables
```

### Configuration on the host

The order matters in two places — both are covered step by step in
`docs/HOSTINGER_DEPLOYMENT.md`:

1. **hPanel build settings first** (Step 2 of that guide): application type
   `Other`, Node `22.x`, package manager `pnpm`, root directory `./`, build
   command `pnpm run build:standalone`, entry file `apps/web/hostinger-server.js`.
   Node 22 is required — `@supabase/supabase-js` declares `engines.node >=22.0.0`.
2. **Environment variables before the first build** (Step 3 of that guide).
   Every `NEXT_PUBLIC_*` value is inlined into the browser bundle at build time,
   so a variable added after the build ships an empty value in the bundle.
   Runtime-only changes then need a restart.

### Verification Pipeline

```bash
pnpm run type-check                     # TypeScript (6/6 packages)
pnpm run lint                           # see note below
pnpm run test                           # Vitest (507 tests, 82 files)
pnpm run format:check                   # Prettier (repo-wide)
pnpm tsx scripts/compliance-check.ts    # FTC/sponsored/privacy/unsubscribe scan
pnpm run check:supabase                 # Supabase reachability, stage by stage
```

### Verification Pipeline

```bash
# Run all checks
pnpm run type-check        # TypeScript (6/6 packages)
pnpm run lint              # see note below
pnpm run test              # Vitest (507 tests, 82 files)
pnpm run format:check      # Prettier (repo-wide)
  pnpm tsx scripts/compliance-check.ts   # FTC/sponsored/privacy/unsubscribe scan
  pnpm run check:supabase                # Supabase reachability, stage by stage
```

> **Note on `lint`:** only `@thinkabell/web` runs real ESLint. `@thinkabell/jobs`,
> `@thinkabell/config`, `@thinkabell/database`, and `@thinkabell/shared` have
> `lint` scripts that only echo a message, and `@thinkabell/edge-worker` has no
> `lint` script at all. `pnpm run lint` therefore reports success for those
> packages without checking them — it is not evidence that they are lint-clean.

> **Note on `compliance-check`:** there is no `compliance-check` script in
> `package.json`; invoke it as `pnpm tsx scripts/compliance-check.ts`.

### Production Deployment

```bash
# Build all packages
pnpm run build

# Run tests before deploying
pnpm run test

# Deploy: push to main — Hostinger's native GitHub integration
# installs, builds (pnpm run build:standalone), and restarts the app
git push origin main
```

---

## 7. Pre-Launch Security Checklist

- [x] **CSP Hardened**: Removed `unsafe-inline`/`unsafe-eval`; nonces for external scripts
- [x] **HSTS Enabled**: `max-age=63072000; includeSubDomains; preload`
- [x] **Permissions-Policy**: `camera=(), microphone=(), geolocation=()`
- [x] **Remote Patterns Restricted**: Allowlisted known image domains only
- [x] **Cron Auth**: Bearer token required for `/api/cron/*`
- [x] **Alerts API Auth**: Bearer token required for `/api/alerts`
- [x] **Revalidation API Auth**: Bearer token required for `POST /api/revalidate` (fail-closed when `REVALIDATION_SECRET` unset)
- [x] **Retailer Links Admin Auth**: Bearer token required for `POST /api/retailer-links`; reads use the anon client (RLS least privilege); writes validate https-only URLs
- [x] **Contact Form**: CSRF token, 5 req/5 min rate limit, zod validation, HTML-escaped email payload
- [x] **Subscriber RLS**: Service role required for mutations; anon can only read own data
- [x] **Unsubscribe Token Auth**: Token required for `/api/unsubscribe`
- [x] **Circuit Breaker**: Redis-backed state persistence
- [x] **Job Locks**: PostgreSQL advisory locks prevent concurrent job execution
- [x] **Data Retention**: Automated archival jobs configured
- [x] **Compliance CI Gates**: `rel="sponsored"`, FTC disclosure, privacy policy, unsubscribe headers

---

## 8. Post-Launch Monitoring

1. **Health Checks**:
   - Monitor `/api/health` for `database` + `cache` connectivity. The response also carries a `config` check listing any environment variable the host delivered that failed validation (names only, never values) — a non-empty list means the corresponding integration is inert.
   - `pnpm --filter @thinkabell/database` logs the Supabase project ref on first client construction (key presence only), so the runtime log names the project it connected to.
2. **Job Monitoring**:
   - Monitor `job_runs` table for failed executions.
   - `monitorJobRuns` job sends email alerts on failures.
   - On Hostinger, check `cron.job_run_details` in Supabase for whether the `pg_cron` jobs fired. `pg_net` dispatches asynchronously, so a job row records that a request was queued, not its HTTP result.
3. **Error Tracking**:
   - Sentry integration gated behind consent (post-launch activation).
4. **Analytics**:
   - PostHog analytics gated behind consent.
5. **Uptime Monitoring**:
   - Configure UptimeRobot or similar for `/api/health`.

---

_This document is maintained by the ThinkaBell engineering team._
