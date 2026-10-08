# ThinkaBell — Complete Setup & Troubleshooting Guide

A dynamic, modular, step-by-step guide to setting up the ThinkaBell monorepo from zero.

**Principles**

- **Dynamic** — no hardcoded values anywhere. Every external dependency is configured through environment variables (see [Appendix B](#appendix-b--environment-variable-reference)).
- **Modular** — every phase verifies independently. If a phase fails, stop, fix it, re-run its verification, then continue.
- **Fail-closed** — every integration degrades safely when unconfigured (skipped, fallback, or explicit HTTP error). Nothing silently uses a fake or hardcoded credential. See [Appendix A](#appendix-a--fail-closed-reference).

## Module map

| Module | Package | Configured via | Verify alone |
| --- | --- | --- | --- |
| Web app (Next.js 14) | `apps/web` (`@thinkabell/web`) | `apps/web/.env.local` | `pnpm --filter @thinkabell/web dev` |
| Scheduled jobs | `apps/jobs` (`@thinkabell/jobs`) | `apps/jobs/.env` | `pnpm --filter @thinkabell/jobs test` |
| Shared config/env schema | `packages/config` (`@thinkabell/config`) | `.env` (root, for scripts) | `pnpm --filter @thinkabell/config test` |
| Database client & repos | `packages/database` | `SUPABASE_*` | `pnpm --filter @thinkabell/database test` |
| Edge worker (geo routing) | `packages/edge-worker` | `wrangler.toml` + worker secrets | `pnpm --filter @thinkabell/edge-worker test` |
| Shared libs (affiliate, rates, geo) | `packages/shared` | env at call sites | `pnpm --filter @thinkabell/shared test` |

---

## Phase 0 — Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | 20 LTS or newer | Check: `node --version` |
| pnpm | 9+ (repo pins `pnpm@12.3.4` via `packageManager`) | Enable with `corepack enable` |
| Supabase project | any | Free tier works; SQL editor needed for Phase 4 |
| Git | any | |

Optional (each module works without it — see Appendix A):

- Upstash Redis (rate limiting / circuit breaker persistence)
- Cloudflare account (edge geo-routing worker)
- Vercel (cron scheduling) or Hostinger (origin hosting)
- Amazon Associates + PA-API, eBay, Walmart, AppSumo, Impact, PartnerStack credentials
- OneSignal (push), Brevo (email), PostHog (analytics), Sentry (errors), UptimeRobot (uptime)

**Windows note:** the optional standalone build (`pnpm build:standalone`) requires symlink support (Windows Developer Mode). Without it, deploy the full project instead — see [Phase 9.1](#91-hostinger).

---

## Phase 1 — Clone & install

```bash
git clone <repository-url>
cd thinkabellclick
corepack enable      # activates the pinned pnpm version
pnpm install
```

Verify: `pnpm --version` reports 9+ (ideally 12.3.4).

---

## Phase 2 — Generate local secrets

Generate four distinct secrets (never reuse a value across variables):

```bash
openssl rand -hex 32    # ENCRYPTION_KEY
openssl rand -hex 32    # BLIND_INDEX_KEY
openssl rand -hex 32    # CRON_SECRET
openssl rand -hex 32    # ALERTS_API_KEY
```

Run each command separately and record the four **distinct** outputs somewhere safe (never commit them). You will paste them into the env files in Phase 3 and into deployment secrets in Phase 9. If any of these values are ever exposed, rotate them immediately.

---

## Phase 3 — Configure environment

### 3.1 Where env files are loaded from

`@thinkabell/config` loads `.env` from the **process working directory** (non-production only, via `dotenv`). Because turbo runs each package task inside its package directory:

| How you run it | Working directory | Env file read |
| --- | --- | --- |
| `pnpm dev` (turbo → web) | `apps/web/` | `apps/web/.env` — Next.js also auto-loads `apps/web/.env.local` (recommended) |
| `pnpm test` (turbo → jobs) | `apps/jobs/` | `apps/jobs/.env` |
| `pnpm tsx scripts/...` (seed, simulate, compliance) | repo root | `.env` |

Keep the copies in sync. All `.env*` variants are gitignored — verify with `git status` after creating them (only `.env.example` is tracked).

### 3.2 Minimal configuration (local development)

```bash
cp .env.example .env
cp .env.example apps/web/.env.local
cp .env.example apps/jobs/.env
```

Edit all three files and set at minimum:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_URL=                    # from Supabase dashboard → Project Settings → API
SUPABASE_ANON_KEY=               # same page
SUPABASE_SERVICE_ROLE_KEY=       # same page (server-side only — never expose to the browser)
```

Next.js only inlines variables prefixed `NEXT_PUBLIC_` into client bundles. Everything else is server-side only.

### 3.3 Module-by-module reference

Fill in additional variables per module as you enable it (details in [Phase 7](#phase-7--optional-module-configuration)):

| Variable(s) | Module | Required? |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Database | Yes (app is empty without them) |
| `ENCRYPTION_KEY`, `BLIND_INDEX_KEY` | PII protection | Production yes; dev fallback warns |
| `AMAZON_ACCESS_KEY`, `AMAZON_SECRET_KEY`, `AMAZON_PARTNER_TAG`, `AMAZON_REGION` | Amazon PA-API | Optional |
| `AMAZON_PARTNER_TAG_UK`, `AMAZON_PARTNER_TAG_DE`, `AMAZON_PARTNER_TAG_CA` | Regional affiliate links | Optional (fail-closed per marketplace) |
| `AMAZON_LIST_URLS`, `AMAZON_LIST_MARKETPLACE`, `AMAZON_LIST_MAX_ITEMS`, `AMAZON_LIST_FETCH_DELAY_MS` | Amazon list hunting | Optional |
| `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_AFFILIATE_CAMPAIGN_ID` | eBay Browse API | Optional |
| `WALMART_API_KEY`, `WALMART_AFFILIATE_ID`, `WALMART_AFFILIATE_TRACK_ID` | Walmart | Optional |
| `APPSUMO_API_KEY`, `IMPACT_API_KEY`, `IMPACT_ACCOUNT_ID`, `PARTNERSTACK_API_KEY` | SaaS affiliate networks | Optional |
| `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, `NEXT_PUBLIC_ONESIGNAL_APP_ID` | Push notifications | Optional |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` | Email alerts | Optional |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Rate limiting / circuit breaker | Optional (in-memory fallback) |
| `EXCHANGE_RATE_API_URL` | Price currency normalization | Optional (default: frankfurter.app; static fallback rates when unreachable) |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Analytics & monitoring | Optional |
| `DISCOVERY_SOURCES` | Discovery job | Optional (empty = nothing discovered) |
| `CRON_SECRET` | `/api/cron/*` authorization | Production yes |
| `ALERTS_API_KEY` | `/api/alerts` authorization | Production yes |
| `CONTACT_EMAIL` | Contact form recipient | Optional (falls back to `BREVO_SENDER_EMAIL`, then `hello@thinkabell.click`) |
| `EDGE_PROXY_TRUSTED` | Geo routing behind Cloudflare worker | Optional, default `"false"` |

Invalid values print `⚠️ [Config] Environment validation warnings:` at startup and fall back to schema defaults — the app still boots.

---

## Phase 4 — Database setup

1. Open the Supabase SQL editor for your project.
2. Run the full contents of `packages/database/schema.sql`.
3. **Existing databases only:** re-run `schema.sql` — it adds the `subscribers.email_hash` unique index (`idx_subscribers_email_hash`) used for blind-index PII lookups.
4. Verify the tables exist: `products`, `price_history`, `subscribers`, `alert_queue`, `retailer_links`, `click_tracking`, `alert_dead_letter`, `job_runs`.
5. Verify Row Level Security is enabled on every table:

```sql
SELECT table_name, row_security
FROM information_schema.tables
WHERE table_schema = 'public' AND row_security = false;
-- Expected: zero rows
```

6. (Optional) Seed starter data: run the contents of `packages/database/seed.sql` (placeholder products, plain retailer URLs), or skip to Phase 5 which seeds via script.

---

## Phase 5 — Seed & smoke test

```bash
pnpm tsx scripts/seed-50-products.ts   # seeds 50 PLACEHOLDER products (synthetic ASINs/ePIDs) - dev data only
pnpm simulate                          # E2E simulation: price drop -> alert queue -> notification delivery
```

**Seeding notes:**
- Requires `SUPABASE_SERVICE_ROLE_KEY`: the `products` table is RLS anon read-only, so the seeder writes through the service-role client and fails closed without the key.
- Seed data is **synthetic placeholder content** (randomized ASINs/ePIDs, static prices) so the pipeline can be exercised end-to-end locally. Replace it with real curated products per `docs/AMAZON_LIST_CURATION.md` before any public launch.
- Seeded retailer URLs are plain (no affiliate tags). Tagged links are generated dynamically per request via `/go/amazon/:asin` and the shared link generator, which fail closed (400/503) when partner tags are not configured.

Smoke-test table (run the web app first — Phase 6):

| Check | Expected result |
| --- | --- |
| `GET /api/health` | `200` with `status: "healthy"` when the database and cache checks pass; `503` with `status: "unhealthy"` and per-check details when either fails |
| `GET /` | `200`, renders seeded deals |
| `POST /api/cron/<job>` without `Authorization` header | `401` — **expected** (fail-closed cron auth; the cron endpoints accept POST only — a GET returns `405`) |
| `GET /api/alerts` without `Authorization` header | `401` — **expected** (bearer token, or `?api_key=` as an alternative) |
| `GET /api/unsubscribe` without `email`/`token` params | `400` — **expected** (token-based, no bearer auth) |
| `GET /go/amazon/B0CM5N4G3T` before partner tags are configured | `503` — **expected** fail-closed geo route (the Cloudflare worker returns `500` for the same condition) |

---

## Phase 6 — Run locally

```bash
pnpm dev                                        # turbo dev — web app on http://localhost:3000 (PORT env overrides)
pnpm --filter @thinkabell/web dev               # web app only
pnpm --filter @thinkabell/edge-worker dev       # wrangler dev — local edge-worker simulation
```

**Jobs:** `@thinkabell/jobs`'s `dev` script is intentionally a no-op — jobs execute on schedules in production (see [Phase 9.3](#93-vercel-cron-jobs)). The runners are exported from `@thinkabell/jobs` (`runProductDiscovery`, `runFetchPrices`, `runSendAlerts`) and are invoked by the cron endpoints in `apps/web/app/api/cron/` (`product-discovery`, `fetch-prices`, `send-alerts`). `pnpm simulate` exercises the alert pipeline end-to-end (price drop → alert queue → notification delivery) but does **not** run discovery. All runners guard against concurrent execution with PostgreSQL advisory locks (the discovery runner uses `try_acquire_job_lock` with lock id `1004`); a second instance exits immediately with "Another instance is already running."

---

## Phase 7 — Optional module configuration

Each subsection: what to set, where to get it, and what works without it.

### 7.1 Amazon Product Advertising API

Variables: `AMAZON_ACCESS_KEY`, `AMAZON_SECRET_KEY`, `AMAZON_PARTNER_TAG` (US default), `AMAZON_REGION` (default `us-east-1`), plus regional tags `AMAZON_PARTNER_TAG_UK`, `AMAZON_PARTNER_TAG_DE`, `AMAZON_PARTNER_TAG_CA`.

Get them: Amazon Associates → Tools → Product Advertising API (access keys) and your Associates profile (partner tags, one per marketplace).

**Eligibility gate:** brand-new Associates accounts receive `AssociateNotEligible` (HTTP 403) from PA-API until the account becomes eligible (typically 10 qualifying sales within 30 days). Use the credential-free list hunting in [7.2](#72-amazon-list-hunting) until then.

Without configuration: the PA-API discovery source is skipped entirely; affiliate link generation fails closed — deal pages fall back to stored affiliate URLs and `/go/amazon/<asin>` returns `503`.

### 7.2 Amazon list hunting

No Amazon login or API credentials — you curate public Amazon List URLs and paste them in:

```dotenv
AMAZON_LIST_URLS=[{"url":"https://www.amazon.com/hz/wishlist/ls/YOUR_LIST_ID","marketplace":"US"}]
AMAZON_LIST_MARKETPLACE=US        # default marketplace for items without an explicit one
AMAZON_LIST_MAX_ITEMS=100         # items harvested per list
AMAZON_LIST_FETCH_DELAY_MS=1000   # polite delay between fetches
```

Then enable the source in `DISCOVERY_SOURCES` (see [7.9](#79-discovery-sources)) with `{"name": "amazon-list", "type": "physical", "queries": [], "enabled": true}`.

- Malformed JSON in `AMAZON_LIST_URLS` throws `AmazonListConfigError` (`"AMAZON_LIST_URLS must be a JSON array of { url, marketplace } entries"` on a parse failure, `"AMAZON_LIST_URLS must be a JSON array"` when the value parses but is not an array). The failure is contained to the `amazon-list` source: the runner records it in the job run's errors and continues with the remaining sources.
- A missing regional partner tag skips that marketplace's affiliate link with a warning (`No affiliate tag configured for <MARKETPLACE>; skipping affiliate link for ASIN ...`) — the product is still harvested with its plain Amazon URL.
- Full workflow, curation rules, and rate-limit guidance: `docs/AMAZON_LIST_CURATION.md`.

### 7.3 eBay Browse API

Variables: `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_AFFILIATE_CAMPAIGN_ID` (from the eBay Developer App and Partner Network). Without them: the eBay discovery source is skipped.

### 7.4 Walmart

Variables: `WALMART_API_KEY`, `WALMART_AFFILIATE_ID`, `WALMART_AFFILIATE_TRACK_ID`. Without them: the Walmart source is skipped.

### 7.5 SaaS affiliate networks

Variables: `APPSUMO_API_KEY`, `IMPACT_API_KEY` + `IMPACT_ACCOUNT_ID`, `PARTNERSTACK_API_KEY`. Without them: those software-discovery sources are skipped.

### 7.6 Notifications

- **Push (OneSignal):** `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, `NEXT_PUBLIC_ONESIGNAL_APP_ID`.
- **Email (Brevo):** `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` (default `noreply@thinkabell.click`), `BREVO_SENDER_NAME` (default `ThinkaBell`).

Without them: alerts are queued but delivery is skipped (fail-closed); subscription capture still works.

The contact form (`/api/contact`) delivers to `CONTACT_EMAIL` when set, otherwise `BREVO_SENDER_EMAIL`, otherwise `hello@thinkabell.click`.

### 7.7 Rate limiting & circuit breaker (Upstash Redis)

Variables: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (from the Upstash console).

Without them: an in-memory fallback is used and the debug log notes `[Redis] Using in-memory cache client (Upstash credentials not provided)`. Configure Redis in production so circuit-breaker state persists across restarts and rate limits are accurate across instances. The circuit breaker opens after 5 consecutive failures (`Circuit opened after 5 failures`) and half-opens to probe recovery. Sensitive routes fail closed (request rejected) if the rate-limit store errors; non-sensitive routes fail open.

### 7.8 Analytics & monitoring

Variables: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (default `https://app.posthog.com`), `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, plus build-time `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` (consumed by `next.config.js`). UptimeRobot and Sentry alerting setup: `docs/UPTIME_MONITORING.md`.

### 7.9 Discovery sources

`DISCOVERY_SOURCES` is a JSON array consumed by the discovery job:

```dotenv
DISCOVERY_SOURCES=[
  {"name": "amazon-list", "type": "physical", "queries": [], "enabled": true},
  {"name": "ebay", "type": "physical", "queries": ["AI gadgets", "smart home"], "enabled": true},
  {"name": "partnerstack", "type": "software", "queries": ["productivity", "developer tools"], "enabled": true}
]
```

Empty/unset, all `enabled: false`, or malformed JSON (a parse failure is logged as `[productDiscovery] Failed to parse DISCOVERY_SOURCES env var` and treated as empty) → the discovery run completes with zero new products (not an error). Unknown source names are skipped with a warning.

### 7.10 Geo routing (Cloudflare edge worker)

The edge worker maps the visitor's Cloudflare country to a regional Amazon destination and injects `x-thinkabell-country`. The origin honors that header **only** when:

```dotenv
EDGE_PROXY_TRUSTED=true
```

Set this **only** when the origin is reachable exclusively through the Cloudflare worker — the header is client-controllable on direct deployments, and the value is used for storefront selection only, never for authorization. Default `"false"` (accepts only `"true"`/`"false"`; anything else triggers a config warning and falls back to `false`).

Anti-spoofing detail: the worker deletes any client-supplied `x-thinkabell-country`/`x-thinkabell-city` headers before injecting its own (derived from Cloudflare's `cf.country`), so downstream services cannot be spoofed via request headers. It also marks responses with `X-Detected-Country`.

Worker secrets (set with `wrangler secret put <NAME>`): `ORIGIN_URL`, `AMAZON_US_TAG`, `AMAZON_GB_TAG`, `AMAZON_DE_TAG`, `AMAZON_CA_TAG`, and optional `DEFAULT_COUNTRY` (fallback, default `US`). Full contract and rollout: `docs/CLOUDFLARE_SETUP.md` (section 7 covers app integration).

### 7.11 Exchange rates (price normalization)

Variable: `EXCHANGE_RATE_API_URL` (default `https://api.frankfurter.app/latest` — a free, key-less FX API).

The price normalizer converts non-USD prices to USD for cross-marketplace comparison. Live rates are fetched from the configured API, cached in Redis for 1 hour, and inverted from units-per-USD to USD-per-unit internally. When the API is unreachable or returns an incomplete payload: static fallback rates apply and the log notes `[ExchangeRateService] Live exchange rate fetch failed; using fallback rates` — price normalization never breaks the price-check pipeline. Fallback rates are negative-cached for 60 seconds so an outage does not trigger a retried fetch for every product in a run.

---

## Phase 8 — Verification pipeline

Run the full gate before any deployment:

```bash
pnpm type-check                          # TypeScript across all 6 packages
pnpm lint                                # ESLint across all packages
pnpm tsx scripts/compliance-check.ts     # FTC gates: sponsored rel, disclosure, privacy, unsubscribe headers
pnpm test                                # 468 Vitest tests (config 14, database 67, edge-worker 16, jobs 31, shared 231, web 109)
pnpm --filter @thinkabell/web run build  # production build: 22 pages + Middleware + /go/amazon/[asin] and /api/cron/* routes
pnpm format:check                        # Prettier
```

**Constrained shells** (some terminals kill long-running commands around 120 seconds): run tests per package instead of the combined `pnpm test`:

```bash
pnpm --filter @thinkabell/config test
pnpm --filter @thinkabell/database test
pnpm --filter @thinkabell/edge-worker test
pnpm --filter @thinkabell/jobs test
pnpm --filter @thinkabell/shared test
pnpm --filter @thinkabell/web test
```

The first Vitest run also transforms all files and is slower than subsequent runs — a slow first run is normal, a timeout is a shell limit, not a test failure.

---

## Phase 9 — Deployment

### 9.1 Hostinger

Full-project deployment (recommended, no symlink requirement): `docs/HOSTINGER_DEPLOYMENT.md`.

Optional standalone bundle (requires symlink support — on Windows enable Developer Mode first; the build fails fast with guidance otherwise):

```bash
pnpm build:standalone     # cross-platform: builds with OUTPUT=standalone injected
pnpm prepare:hostinger    # packages dist/hostinger-deploy/
# or both in one command:
pnpm package:hostinger
```

Do **not** set `OUTPUT=standalone` manually via the shell (`set`/`export` syntax is platform-dependent) — `pnpm build:standalone` injects it into the build environment. If the build fails with symlink errors, deploy the full project instead.

### 9.2 Cloudflare edge worker

```bash
pnpm --filter @thinkabell/edge-worker deploy
```

Before deploying for production, set the secrets (`wrangler secret put <NAME>`): `ORIGIN_URL`, `AMAZON_US_TAG`, `AMAZON_GB_TAG`, `AMAZON_DE_TAG`, `AMAZON_CA_TAG` (and optional `DEFAULT_COUNTRY`), then uncomment the `routes` block in `packages/edge-worker/wrangler.toml`. The worker fails closed with 5xx when `ORIGIN_URL` or a partner tag is unset.

### 9.3 Vercel cron jobs

`vercel.json` defines **three** cron jobs (Vercel dashboard → Cron Jobs mirrors these; all are POST endpoints requiring header `Authorization: Bearer <CRON_SECRET>`, with a per-IP fail-closed rate limit of 10 requests / 60 s):

| Job | Endpoint | Schedule (from `vercel.json`) |
| --- | --- | --- |
| Product discovery | `/api/cron/product-discovery` | `0 */6 * * *` (every 6 hours) |
| Price fetch | `/api/cron/fetch-prices` | `0 */6 * * *` (every 6 hours) |
| Send alerts | `/api/cron/send-alerts` | `0 */6 * * *` (every 6 hours) |

Vercel cron jobs send `POST` by default, which matches the route handlers. A `401` response means the header's `CRON_SECRET` does not match the server's — fix the mismatch (see [10.4](#104-authentication--authorization)); a `429` means the endpoint is being called too frequently. The discovery endpoint invokes `runProductDiscovery()` from `@thinkabell/jobs`, which acquires advisory lock `1004` — overlapping invocations exit immediately instead of running concurrently.

---

## Phase 10 — Troubleshooting (step by step)

### 10.1 Decision flow

1. Does the message start with `⚠️ [Config]`? → [10.2 Configuration & startup](#102-configuration--startup)
2. Is it an HTTP error? → check [10.3](#103-expected-fail-closed-responses-not-bugs) first — most 4xx/5xx responses are intentional fail-closed behavior; then [10.4](#104-authentication--authorization).
3. Is it a data problem (no products, no alerts, no links)? → [10.5](#105-database) and [10.6](#106-discovery--affiliate-links).
4. Is it a build or tooling error? → [10.7](#107-build--tooling).

### 10.2 Configuration & startup

| Symptom | Cause | Fix |
| --- | --- | --- |
| `⚠️ [Config] Environment validation warnings:` at startup | An env value fails the Zod schema (e.g. `EDGE_PROXY_TRUSTED` set to something other than `"true"`/`"false"`, malformed URL, non-numeric `PORT`) | Set the named variable to a valid value; the app continues with safe defaults meanwhile |
| `AmazonListConfigError: AMAZON_LIST_URLS must be a JSON array of { url, marketplace } entries` (parse failure) or `... must be a JSON array` (parses but not an array) | Malformed `AMAZON_LIST_URLS` | Validate the JSON (quote escaping is the usual culprit in `.env` files); the `amazon-list` source fails for that run and the error is recorded in the job run's errors — other sources continue |
| Debug log: `[Redis] Using in-memory cache client (Upstash credentials not provided)` | `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` unset | Harmless in dev; set both for production |
| Warning: `[BlindIndex] BLIND_INDEX_KEY is not set. Using lower-case fallback (dev mode only).` | PII stored plaintext with lower-case lookup indexes | Generate and set `ENCRYPTION_KEY` + `BLIND_INDEX_KEY` for production |
| `[productDiscovery] Failed to parse DISCOVERY_SOURCES env var` | Malformed JSON in `DISCOVERY_SOURCES` | Fix the JSON; the run treats it as "no sources configured" (zero products) |
| `pnpm: command not found` | pnpm not installed/activated | `corepack enable`, or install pnpm 9+ |
| `pnpm install` peer-dependency errors | Store or lockfile drift | `pnpm install --force`, then re-run `pnpm install` |

### 10.3 Expected fail-closed responses (not bugs)

| Response | Where | Meaning |
| --- | --- | --- |
| `401` | `/api/cron/*` (POST), `/api/alerts` | Missing/invalid bearer token — auth is fail-closed |
| `400` | `/api/unsubscribe` | Missing `email`, or missing/invalid unsubscribe token (token-based, no bearer auth) |
| `403` | `/api/contact` | CSRF token invalid/expired — reload the form; ensure cookies are not blocked |
| `429` | `/api/contact` (5 requests / 5 min per IP), `/api/alerts` (30 / min), cron endpoints (10 / min) | Rate limit engaged; these routes fail closed to 429 when the store errors |
| `405` | `/api/cron/*` | GET request — cron endpoints accept POST only |
| `503` | `/go/amazon/<asin>` (origin route) | Regional partner tag not configured for the visitor's marketplace |
| `500` | `/go/amazon/<asin>` (Cloudflare worker) | Regional affiliate tag not set in worker secrets |
| `400` | `/go/amazon/<asin>` | Malformed ASIN in the URL |
| `503` | edge worker (all other paths) | `ORIGIN_URL` secret not set |
| `503` | `/api/health` | A dependency check (database or cache) failed — the body lists per-check details |
| Empty deal page fallback URL | deal page | Affiliate link generation failed closed — stored URL used instead |

### 10.4 Authentication & authorization

| Symptom | Cause | Fix |
| --- | --- | --- |
| `401` from `/api/cron/<job>` | `CRON_SECRET` missing on the server or mismatched with the cron job's `Authorization` header (and the request must be POST) | Set identical values in both places |
| `401` from `/api/alerts` | `ALERTS_API_KEY` missing/mismatched (accepts `Authorization: Bearer <key>` or `?api_key=<key>`) | Set identical values in both places |
| `403` from `/api/contact` on every submit | CSRF cookie blocked or token expired | Check cookie settings; reload the page |
| `new row violates row-level security policy` on subscriber insert | Row inserted without `email`/`email_hash` (insert policy requires both) | The app computes the blind index server-side; if seeding manually, supply both columns |

### 10.5 Database

| Symptom | Cause | Fix |
| --- | --- | --- |
| Empty homepage / health reports degraded | `SUPABASE_URL` empty (client fails closed) or Phase 4 not run | Complete [Phase 4](#phase-4--database-setup) |
| Missing `idx_subscribers_email_hash` on an existing DB | Schema predates the blind-index migration | Re-run `packages/database/schema.sql` |
| No price history for amazon-list products on an old database | Older rows predate the `amazon_asin` propagation fix | Re-harvest the list (re-run discovery) so rows carry `amazon_asin` |
| Duplicate alerts | Two job runners executing concurrently | Runners guard with PostgreSQL advisory locks (`try_acquire_job_lock`; discovery uses lock id `1004`) — a second instance exits immediately. Ensure only one scheduler triggers each job |

### 10.6 Discovery & affiliate links

| Symptom | Cause | Fix |
| --- | --- | --- |
| Discovery completes with 0 products | `DISCOVERY_SOURCES` unset/empty, or every source `enabled: false` | Set `DISCOVERY_SOURCES` per [7.9](#79-discovery-sources) |
| `AssociateNotEligible` / HTTP 403 from PA-API | New Associates account not yet eligible | Use [7.2](#72-amazon-list-hunting) until eligible |
| Products harvested without affiliate links | Regional partner tag missing for that marketplace | Set `AMAZON_PARTNER_TAG` (+ `_UK`/`_DE`/`_CA` as needed) |
| `AmazonListConfigError` in job run errors | Malformed `AMAZON_LIST_URLS` — the `amazon-list` source failed for that run; other sources continued | Fix the JSON; re-run discovery |
| `/go/amazon/<asin>` returns `503` | Origin-side partner tag unconfigured | Configure tags on the origin (and worker secrets if geo routing is active) |
| Geo always falls back to one marketplace | `EDGE_PROXY_TRUSTED` is `"false"` (default) while behind the worker | Set `EDGE_PROXY_TRUSTED=true` **only** if the origin is reachable solely via the worker |

### 10.7 Build & tooling

| Symptom | Cause | Fix |
| --- | --- | --- |
| Build fails with symlink errors on Windows | `output: standalone` requires symlink support | Enable Windows Developer Mode, or deploy the full project instead of the standalone bundle |
| Test command killed after ~120 s | Shell time limit, not a test failure | Run tests per package ([Phase 8](#phase-8--verification-pipeline)) |
| Very slow first `pnpm test` | One-time Vitest transform | Subsequent runs are faster |
| `pnpm compliance-check` fails | Not a defined script | Correct command: `pnpm tsx scripts/compliance-check.ts` |
| `pnpm run seed` fails | Not a defined script | Correct command: `pnpm tsx scripts/seed-50-products.ts` |

### 10.8 Platform notes

- **Windows:** prefer the full-project Hostinger deployment over the standalone bundle; use Git Bash or a POSIX-compatible shell for the OpenSSL steps.
- **First deployment:** run [Phase 8](#phase-8--verification-pipeline) locally before deploying anything.
- **Rollbacks:** deployments are stateless — redeploy the previous bundle; the database schema is forward-compatible (re-running `schema.sql` is idempotent for indexes).

---

## Appendix A — Fail-closed reference

| Module | When unconfigured | Behavior |
| --- | --- | --- |
| Database client (`SUPABASE_URL` empty) | Always required for data | Client fails closed; health endpoint reports degraded |
| Amazon PA-API credentials | Discovery | Source skipped entirely |
| Amazon partner tag (any region) | Affiliate links | `AmazonAffiliateLinkError` — deal page falls back to stored URL; origin `/go/amazon/<asin>` → `503`; worker `/go/amazon/:asin` → `500`; worker proxy → `503` only when `ORIGIN_URL` is unset |
| `AMAZON_LIST_URLS` malformed | List hunting | `AmazonListConfigError` — the `amazon-list` source fails for that run (recorded in job run errors); other sources continue |
| List partner tag missing | List hunting | Affiliate link skipped with warning; product harvested with plain URL |
| eBay / Walmart / SaaS credentials | Discovery | Source skipped |
| OneSignal / Brevo | Notifications | Alerts queued, delivery skipped |
| Upstash Redis | Rate limiting / circuit breaker | In-memory fallback; breaker state not persisted; sensitive routes fail closed on store errors |
| `ENCRYPTION_KEY` / `BLIND_INDEX_KEY` | PII | Plaintext with lower-case lookup indexes (dev fallback; warning logged) |
| `CRON_SECRET` / `ALERTS_API_KEY` | Job & alerts APIs | Endpoints return `401` |
| `EDGE_PROXY_TRUSTED=false` (default) | Geo routing | `x-thinkabell-country` ignored; marketplace falls back to `AMAZON_LIST_MARKETPLACE` default |
| `DISCOVERY_SOURCES` empty or malformed | Discovery job | Zero products discovered (parse failures are logged and treated as empty — not an error) |

## Appendix B — Environment variable reference

Full reference with defaults: `.env.example`. Schema source of truth: `packages/config/src/env.ts` (Zod). Database-layer secrets (`ENCRYPTION_KEY`, `BLIND_INDEX_KEY`) are read directly from the environment by `packages/database`. Standalone builds are produced by `pnpm build:standalone` (see [9.1](#91-hostinger)) — never set `OUTPUT` manually.

**Never commit** `.env`, `.env.local`, or any variant — they are gitignored. `.env.example` is the only tracked template.

## Related documentation

- `README.md` — architecture & command overview
- `docs/LAUNCH_CHECKLIST.md` — pre-launch gates
- `docs/HOSTINGER_DEPLOYMENT.md` — Hostinger walkthrough
- `docs/CLOUDFLARE_SETUP.md` — Cloudflare worker & geo routing
- `docs/AMAZON_LIST_CURATION.md` — Amazon list hunting workflow
- `docs/UPTIME_MONITORING.md` — observability setup
- `docs/PRE_LAUNCH_AUDIT.md` — audit findings & fixes
