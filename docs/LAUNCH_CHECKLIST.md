# ThinkaBell Official Launch & Operations Playbook

This operational playbook details the pre-launch checklist, content marketing templates, social media syndication, and post-launch maintenance routines for **thinkabell.click**.

---

## 1. Pre-Launch Verification Checklist

- [x] **Supabase Database Initialized**:
  - [x] Run `packages/database/schema.sql` in Supabase SQL editor.
  - [x] Verify tables: `products`, `price_history`, `subscribers`, `alert_queue`, `retailer_links`, `click_tracking`, `alert_dead_letter`, `job_runs`.
  - [x] Confirm Row Level Security (RLS) is active on all tables.
  - [x] Confirm `subscribers.email_hash` exists with unique index `idx_subscribers_email_hash` (blind index for PII lookups; re-run `schema.sql` on existing databases to add it).
  - [x] Run `pnpm tsx scripts/seed-50-products.ts` or run `packages/database/seed.sql` to populate 50 starter deals. **Note:** both seed **synthetic placeholder data** (randomized ASINs/ePIDs, static prices) for local pipeline testing only — replace with real curated products (`docs/AMAZON_LIST_CURATION.md`) before any public launch. Seeding requires `SUPABASE_SERVICE_ROLE_KEY` (products RLS is anon read-only).
- [ ] **PII Keys Configured (production)**:
  - [ ] Generate `ENCRYPTION_KEY` and `BLIND_INDEX_KEY` (`openssl rand -hex 32` — two different values) and set them as Vercel/Hostinger secrets. Until set, PII is stored in plaintext with lower-case lookup indexes (dev fallback).
- [x] **DNS & Cloudflare Configured**:
  - [ ] Domain `thinkabell.click` pointed to Cloudflare nameservers.
  - [ ] SSL/TLS set to **Full (strict)**.
  - [ ] Page Rule enabled for caching HTML (Cache Everything, 5 min TTL).
  - [ ] Brotli and Always Online toggled ON.
- [x] **Hostinger Deployment Tested**:
  - [ ] Application running on Node 20 or 22.
  - [ ] Startup file set to `hostinger-server.js`.
  - [ ] Health check responds `200 OK` at `https://thinkabell.click/api/health`.
- [x] **Vercel Cron / pg_cron Jobs Active**:
  - [x] `vercel.json` configured with cron schedules for `/api/cron/product-discovery`, `/api/cron/fetch-prices`, and `/api/cron/send-alerts` (all every 6 hours).
  - [x] Confirm `/api/cron/fetch-prices` and `/api/cron/send-alerts` return `200 OK` with valid `CRON_SECRET`.
  - [ ] Supabase `pg_cron` scheduled if not using Vercel Cron.
- [x] **OneSignal & Brevo Configured**:
  - [ ] OneSignal App ID added for Web Push permissions.
  - [ ] Brevo API key configured for email alert delivery.
- [x] **Product Discovery Configured**:
  - [ ] Set `DISCOVERY_SOURCES` environment variable in `apps/jobs/.env` with desired sources and queries.
  - [ ] Configure API credentials for enabled sources (`EBAY_*`, `WALMART_API_KEY`, `PARTNERSTACK_API_KEY`, `APPSUMO_API_KEY`, `IMPACT_API_KEY`).
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
  > 1. Whitelist our email address so alerts never land in spam.
  > 2. [Browse today's top price drops on ThinkaBell](https://thinkabell.click)
  >
  > Happy saving!  
  > *The ThinkaBell Team*

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
       {"name": "ebay", "type": "physical", "queries": ["AI gadgets", "smart home"], "enabled": true},
        {"name": "partnerstack", "type": "software", "queries": ["productivity", "developer tools"], "enabled": true}
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
   - Trigger discovery via `POST /api/cron/product-discovery` (Vercel Cron, every 6 hours — see `vercel.json`) with the `CRON_SECRET` bearer token, or call `runProductDiscovery()` from `@thinkabell/jobs` directly.
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

# 2. Install dependencies
pnpm install

# 3. Copy environment files
cp .env.example apps/web/.env.local
cp .env.example apps/jobs/.env

# 4. Set required secrets in .env.local and .env
#    - NEXT_PUBLIC_SUPABASE_URL
#    - NEXT_PUBLIC_SUPABASE_ANON_KEY
#    - SUPABASE_SERVICE_ROLE_KEY
#    - UPSTASH_REDIS_REST_URL
#    - UPSTASH_REDIS_REST_TOKEN
#    - ALERTS_API_KEY
#    - CRON_SECRET

# 5. Run database schema in Supabase SQL Editor
#    - packages/database/schema.sql
#    - packages/database/seed.sql

# 6. Start development servers
pnpm --filter @thinkabell/web dev
pnpm --filter @thinkabell/jobs dev
```

### Verification Pipeline
```bash
# Run all checks
pnpm run type-check    # TypeScript compilation (6/6 packages)
pnpm run lint          # ESLint (5/5 packages)
pnpm run test          # Vitest suite (482 tests)
pnpm run compliance-check  # FTC/sponsored/privacy/unsubscribe scan
```

### Production Deployment
```bash
# Build all packages
pnpm run build

# Run tests before deploying
pnpm run test

# Deploy via CI/CD (GitHub Actions)
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
   - Monitor `/api/health` endpoint for DB + Redis connectivity.
2. **Job Monitoring**:
   - Monitor `job_runs` table for failed executions.
   - `monitorJobRuns` job sends email alerts on failures.
3. **Error Tracking**:
   - Sentry integration gated behind consent (post-launch activation).
4. **Analytics**:
   - PostHog analytics gated behind consent.
5. **Uptime Monitoring**:
   - Configure UptimeRobot or similar for `/api/health`.

---

*This document is maintained by the ThinkaBell engineering team.*
