# ThinkaBell 🔔

> Real-time deal alert and price tracking platform for AI gadgets, smart home hardware, and developer software.

Monitors prices across **eBay Browse API** and **SaaS Affiliate Networks** (PartnerStack, AppSumo, Impact), with instant push notifications via **OneSignal** and transactional email via **Brevo**.

---

## 🏗 Architecture Overview

```text
thinkabell/
├── apps/
│   ├── web/               # Next.js 14+ App Router, ISR, Tailwind CSS, OneSignal SDK
│   └── jobs/              # Scheduled job runners (fetchPrices, sendAlerts, productDiscovery) invoked by /api/cron/*
├── packages/
│   ├── config/            # Zod runtime environment validation & app config
│   ├── database/          # Supabase PostgreSQL schema, RLS policies, typed repositories
│   ├── shared/            # Domain types, API clients (Amazon, eBay, OneSignal, Brevo), Upstash Redis
│   └── edge-worker/       # Cloudflare Worker for edge geo-routing & affiliate link localization
├── scripts/
│   ├── simulate-pipeline.ts   # Full E2E price drop -> alert queue -> notification delivery simulation
│   ├── seed-50-products.ts     # 50 placeholder products (unverified ASINs/prices)
│   ├── build-standalone.js     # Cross-platform standalone build (injects OUTPUT=standalone)
│   ├── prepare-hostinger.js   # Packages Next.js standalone bundle for Hostinger Node.js hosting
│   └── compliance-check.ts    # FTC/sponsored/privacy/unsubscribe compliance scan
├── docs/
│   ├── SETUP_GUIDE.md       # Complete setup & troubleshooting guide (start here)
│   ├── HOSTINGER_DEPLOYMENT.md # Hostinger hPanel Node.js setup guide
│   ├── CLOUDFLARE_SETUP.md     # Edge caching, SSL Full (strict), Page Rules, and Worker guide
│   ├── UPTIME_MONITORING.md    # UptimeRobot & Sentry configuration
│   ├── LAUNCH_CHECKLIST.md     # Email sequences, social syndication, SEO checklist
│   └── PRE_LAUNCH_AUDIT.md     # Security, business, UX, backend, SEO audit findings
├── .github/workflows/
│   ├── ci.yml              # CI pipeline: type-check, lint, test
│   ├── deploy.yml          # Hostinger deployment
│   └── legal-gate.yml      # Compliance gates (sponsored/FTC/privacy/unsubscribe)
├── turbo.json              # Turborepo task pipeline & caching
├── agent.md                # Master implementation plan, board directives, sprint roadmap
└── pnpm-workspace.yaml     # Workspace definition
```

---

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js**: v20 or v22 (LTS)
- **pnpm**: v9+ / v12+ (`npm install -g pnpm`)
- **Supabase**: Project created at [supabase.com](https://supabase.com)

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Variables

Copy `.env.example` to `.env.local` for `apps/web` and `.env` for `apps/jobs`:

```bash
cp .env.example apps/web/.env.local
cp .env.example apps/jobs/.env
```

For the complete step-by-step setup, module-by-module configuration, and troubleshooting, see [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md).

Required secrets:
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
- `ALERTS_API_KEY` — bearer token for `/api/alerts`
- `CRON_SECRET` — bearer token for `/api/cron/*`
- `RETAILER_LINKS_API_KEY` — bearer token for POST `/api/retailer-links` (fail-closed when unset)
- `REVALIDATION_SECRET` — token for on-demand ISR purge at `/api/revalidate` (fail-closed when unset)
- `ENCRYPTION_KEY` / `BLIND_INDEX_KEY` — 64-char hex (`openssl rand -hex 32`) for PII encryption & blind-index lookups
- SaaS API credentials (optional, fail-closed when missing): `AMAZON_*`, `EBAY_*`, `WALMART_API_KEY`, `PARTNERSTACK_API_KEY`, `APPSUMO_API_KEY`, `IMPACT_API_KEY`, `ONESIGNAL_*`, `BREVO_API_KEY`

### 4. Database Setup (Supabase)

1. Open Supabase **SQL Editor**.
2. Run `packages/database/schema.sql`.
3. Run `packages/database/seed.sql` to populate baseline products.

### 5. Run Development Servers

```bash
# Start Next.js frontend (http://localhost:3000)
pnpm --filter @thinkabell/web dev

# Start jobs locally (Vercel Cron / pg_cron in production)
pnpm --filter @thinkabell/jobs dev
```

---

## 🛠 Monorepo Commands

| Command | Action |
|---|---|
| `pnpm dev` | Run all applications in development mode |
| `pnpm build` | Build all packages and applications via Turborepo |
| `pnpm type-check` | Run TypeScript compilation checks across the monorepo |
| `pnpm lint` | Run ESLint across all apps and packages |
| `pnpm test` | Run full Vitest suite across all packages |
| `pnpm simulate` | Run the full End-to-End price drop simulation test |
| `pnpm build:standalone` | Production web build with `output: standalone` (cross-platform; injects `OUTPUT=standalone`) |
| `pnpm prepare:hostinger` | Package the standalone build into `dist/hostinger-deploy/` |
| `pnpm package:hostinger` | Build standalone + package the Hostinger bundle in one command |
| `pnpm tsx scripts/compliance-check.ts` | Run FTC/sponsored/privacy/unsubscribe compliance scan |

---

## 🧪 Testing System

The project uses **Vitest** with a comprehensive test suite covering:

| Package | Test Coverage | Status |
|---|---|---|
| `@thinkabell/config` | Environment validation, Zod schema parsing, env singleton | ✅ 14/14 passing |
| `@thinkabell/database` | Supabase client (fail-closed), repositories (Product, Alert, Subscriber, PriceHistory, RetailerLink, Comparison) | ✅ 67/67 passing |
| `@thinkabell/shared` | API clients (Amazon, eBay, Walmart, AffiliateNetwork, Notification, PartnerStack, AppSumo, Impact), utilities (Redis, Retry, CircuitBreaker, Logger, RateLimit, ProgramStability, CursorPagination, FieldEncryption, BlindIndex) | ✅ 236/236 passing |
| `@thinkabell/web` | Retailer Links API, Click Tracking, Sponsored Retailer routes, Search API, Compare API, Deal components, Compare components, Cookie Consent, Subscribe Modal, Error Boundary, Skeleton loaders | ✅ 118/118 passing |
| `@thinkabell/jobs` | fetchPricesRunner, sendAlertsRunner with circuit breakers, DND, dead-letter handling, job-run monitoring | ✅ 31/31 passing |
| `@thinkabell/edge-worker` | Edge geo-routing, affiliate localization, origin proxy, anti-spoofing headers | ✅ 16/16 passing |

**Total: 482 tests, all passing.**

### Running Tests

```bash
# Run all tests across the monorepo
pnpm test

# Run tests for a specific package
pnpm --filter @thinkabell/database test
pnpm --filter @thinkabell/shared test
pnpm --filter @thinkabell/web test
pnpm --filter @thinkabell/jobs test
```

---

## 📋 Implementation Status

### ✅ Completed (Sprint 0 — Foundation)

| Component | Status | Details |
|---|---|---|
| **Monorepo Scaffold** | ✅ Complete | pnpm workspaces, Turborepo, TypeScript strict, ESLint, Vitest |
| **Email Migration** | ✅ Complete | MailerLite → Brevo; List-Unsubscribe header, unsubscribe flow |
| **Job Scheduler** | ✅ Complete | Vercel Cron + Supabase `pg_cron`; no Trigger.dev dependency |
| **Database Schema** | ✅ Complete | 10+ tables, RLS, full-text search TSVECTOR/GIN, indexes |
| **Type Definitions** | ✅ Complete | Typed Supabase schema in `packages/database/src/types.ts` |
| **Repositories** | ✅ Complete | Product, Alert, Subscriber, PriceHistory, RetailerLink with tests |
| **Shared Utilities** | ✅ Complete | retry, circuitBreaker, rateLimit, redis, logger, programStability |
| **External API Clients** | ✅ Complete | Amazon, eBay, Walmart, OneSignal, Brevo, PartnerStack, AppSumo, Impact — fail-closed when credentials missing |
| **Jobs** | ✅ Complete | fetchPrices, sendAlerts, deadLetterRetry, monitorJobRunners; circuit breakers, DND, advisory locks |
| **Cron Endpoints** | ✅ Complete | `/api/cron/*` with Bearer auth + rate limiting |
| **Health Endpoint** | ✅ Complete | `/api/health` with DB + Redis connectivity checks |
| **Retailer Link API** | ✅ Complete | Links, sponsored links, click tracking with RLS |
| **Search API** | ✅ Complete | Full-text search via TSVECTOR, rate limiting, category/discount filters |
| **Legal Pages** | ✅ Complete | Privacy policy, terms of service, unsubscribe confirmation |
| **Security Headers** | ✅ Complete | CSP, X-Frame-Options, Referrer-Policy, HSTS, Permissions-Policy |
| **Cookie Consent** | ✅ Complete | Consent banner with tracker-blocking event bus |
| **Compliance CI Gates** | ✅ Complete | `rel="sponsored"`, FTC disclosure, privacy-policy link, Brevo unsubscribe header |
| **CI/CD** | ✅ Complete | GitHub Actions CI with type-check, lint, test, post-deploy smoke test |
| **Test Infrastructure** | ✅ Complete | 482 tests passing across config, database, shared, web, jobs, edge-worker |
| **Seed Data** | ✅ Complete | 50 placeholder products (unverified ASINs/prices); affiliate links generated from env config, fail-closed to plain URLs |
| **Deal Detail Page** | ✅ Complete | Dual-track SaaS/physical rendering; JSON-LD (Product, BreadcrumbList, SpeakableSpecification) |
| **Product Comparison** | ✅ Complete | `/compare` side-by-side table (price, discount, brand, tags) with best-price highlight; localStorage picker (max 4) via `CompareProvider`/`CompareToggle`/`CompareBar`; floating compare bar; rate-limited `/api/compare` endpoint |
| **Alert Quality Score** | ✅ Complete | 0–100 score UI with color-coded confidence levels |
| **Subscribe Flow** | ✅ Complete | Two-step modal, deep-link `?product=slug`, rate limiting, preferences |
| **Trust Metrics** | ✅ Complete | Price freshness badge, transparency banner, deal countdown, promo code copy |
| **Homepage UX** | ✅ Complete | Deal of the Day hero, SaaS section, How It Works, Subscribe CTA |
| **Business Documentation** | ✅ Complete | Business case addendum, 12-month P&L (3 scenarios), DPA review |
| **Unsubscribe Flow** | ✅ Complete | `/api/unsubscribe` endpoint with token auth, confirmed page, `unsubscribed_at` column |
| **Mobile Navigation** | ✅ Complete | Responsive hamburger menu with ARIA attributes |
| **Accessibility (WCAG)** | ✅ Complete | Tap targets ≥44x44px, color contrast AA, ARIA labels, focus trap in modal |
| **SEO Metadata** | ✅ Complete | `generateMetadata` on all pages, canonical URLs, hreflang, `noindex` on thin pages |
| **Structured Data** | ✅ Complete | Product, BreadcrumbList, SpeakableSpecification, WebSite JSON-LD |
| **Commission Routing** | ✅ Complete | `/api/route-link` routes to highest-commission retailer, click tracking |
| **Circuit Breaker** | ✅ Complete | Redis-backed state persistence, auto-load on construction |
| **Job Monitoring** | ✅ Complete | `job_runs` table, advisory locks, dead-letter retry, monitoring alerts |
| **Data Retention** | ✅ Complete | Automated archival functions for `price_history` (2 years), `click_tracking` (1 year), `alert_queue` (90 days), `dead_letter_queue` (30 days), `job_runs` (30 days) |
| **Product Discovery Automation** | ✅ Complete | Config-driven `DISCOVERY_SOURCES` env var, dynamic product fetching from eBay, Walmart, PartnerStack, AppSumo, Impact, and manually curated Amazon Lists with full details (images, descriptions, affiliate URLs) |
| **Rich Media Support** | ✅ Complete | `images` TEXT[], `video_url`, and `metadata` JSONB columns for storing multi-media product data |
| **Security Hardening** | ✅ Complete | IP anonymization, CSRF protection, PII field encryption (AES-256-GCM at rest, keyed HMAC-SHA256 blind index for lookups, fail-closed, tested), click attribution tokens, data erasure workflow |
| **Infrastructure** | ✅ Complete | Database backup script, Cloudflare _headers, Cache-Control headers, Supabase singleton TTL refresh |

### 🔄 Remaining Production Hardening (Sprint 0 Close-out)

| Task | Priority | Status |
|---|---|---|
| **Error Boundaries** | 🟠 High | ✅ Complete — global `ErrorBoundary` + not-found page |
| **Loading Skeletons** | 🟠 High | ✅ Complete — `DealCardSkeleton`, `SearchResultsSkeleton`, `HomepageSectionSkeleton` |
| **Pagination Cursor** | 🟠 High | ✅ Complete — `encodeCursor`/`decodeCursor` utilities; search API paginated |
| **Idempotency Keys** | 🟡 Medium | ✅ Complete — `/api/subscribe` supports `Idempotency-Key` header |
| **Sentry/PostHog** | 🟡 Medium | ✅ Complete — SDK initialization gated behind consent |
| **Design System** | 🟢 Low | Deferred to post-launch; using Tailwind utilities |

### 🚀 Post-Launch (Sprint 4+)

| Feature | Reason Deferred |
|---|---|
| Design-system token namespaces | Tailwind utilities sufficient for MVP |
| Visual QA pipeline (Playwright) | Post-launch quality hardening |
| Sentiment infrastructure | Legal review required |
| S2S postback/webhook ingestion | Commission validation via dashboard first |
| Full comparison tables | "Also consider" algorithm sufficient for MVP |
| `/alerts` dashboard | Simple thresholds in MVP; full dashboard post-launch |
| Natural language search | Post-launch SEO enhancement |
| Hostinger → Vercel/Cloudflare Pages migration | Planned within 3–6 months |
| Watchlist feature | Deferred per Product/Business Strategist |

---

## 🔑 Key Decisions

- **Per-subscriber alert queue**: One `alert_queue` row per (product + subscriber) enables DND, dead-letter queue, daily digests, and quality scoring.
- **Brevo for email**: 9,000 emails/month free tier; `List-Unsubscribe` header for compliance.
- **OneSignal for push**: 10,000 web push subscribers free; Telegram/Discord as zero-cost backups.
- **Vercel Cron + pg_cron**: Replaced Trigger.dev to eliminate job-runner license costs.
- **Placeholder catalog first**: 50 products seeded with unverified ASINs/prices; replace with genuinely curated entries via Amazon List curation (`AMAZON_LIST_URLS`) — no PA-API dependency until eligibility earned.
- **SaaS-first revenue**: Physical commissions 1–4%; SaaS commissions 20–60% recurring. Year-one physical revenue projected at $0.
- **Fail-closed integrations**: All SaaS API clients throw errors when credentials missing instead of returning simulated data.
- **PII at rest**: Subscribers' email and push token are encrypted (AES-256-GCM) when `ENCRYPTION_KEY` is set; lookups use a keyed HMAC-SHA256 blind index (`subscribers.email_hash` via `BLIND_INDEX_KEY`) instead of plaintext email matching.
- **Click attribution (no PII in URLs)**: `/api/route-link` records every click with a unique `attribution_token` and sets an HttpOnly `tb_click` cookie; `/api/subscribe` attributes that click to the subscriber via the cookie, and erasure (`/api/unsubscribe`) detaches the click links.
- **Dynamic product discovery**: `DISCOVERY_SOURCES` JSON env var configures which sources to query; Amazon hunting harvests manually curated public lists via `AMAZON_LIST_URLS` (no API, no credentials). No hardcoded product lists or mock data.
- **Full product detail enrichment**: After search, each product detail endpoint fetches complete metadata including images, descriptions, and affiliate URLs.
- **Modular source adapters**: Each marketplace/SaaS network implements the same `ProductSource` interface, making it trivial to add new sources.

---

## 🤖 Product Discovery Automation

ThinkaBell includes a fully dynamic product discovery system that automatically fetches complete product details from multiple sources.

### Supported Sources

| Source | Type | Details Fetched |
|--------|------|-----------------|
| **eBay Browse API** | Physical | Images, descriptions, seller info, shipping, condition, affiliate URLs |
| **Walmart API** | Physical | Images, descriptions, brand, category, product URLs |
| **PartnerStack** | Software | Logo URLs, descriptions, vendor info, commission rates |
| **AppSumo** | Software | Descriptions, vendor info, commission rates, expiry dates |
| **Impact** | Software | Logo URLs, descriptions, advertiser info, commission rates |
| **Amazon Lists** | Physical | Manually curated public Amazon Lists — ASIN, title, price, image, affiliate links (no API, no login credentials) |

### Configuration

Product discovery is configured via the `DISCOVERY_SOURCES` environment variable:

```bash
DISCOVERY_SOURCES='[
  {"name": "ebay", "type": "physical", "queries": ["AI gadgets", "smart home"], "enabled": true},
  {"name": "walmart", "type": "physical", "queries": ["laptop", "headphones"], "enabled": true},
  {"name": "partnerstack", "type": "software", "queries": ["productivity", "developer tools"], "enabled": true},
  {"name": "appsumo", "type": "software", "queries": ["lifetime deal", "AI tools"], "enabled": true},
  {"name": "impact", "type": "software", "queries": ["SaaS", "enterprise"], "enabled": true},
  {"name": "amazon-list", "type": "physical", "queries": [], "enabled": true}
]'
```

Amazon hunting uses **manual data curation**: you curate public Amazon
Lists in your own account and supply the public URLs via `AMAZON_LIST_URLS`.
The module never uses the Amazon API and never stores or uses Amazon
login credentials. Optional `queries` act as title filters for the
harvested items. See `docs/AMAZON_LIST_CURATION.md` for the full model.

### Amazon Affiliate Link Generation

Affiliate links are generated by the modular
`amazonAffiliateLinkGenerator` (`packages/shared/src/api/amazonAffiliateLinkGenerator.ts`):
per-marketplace partner tags come from `AMAZON_PARTNER_TAG`,
`AMAZON_PARTNER_TAG_UK`, `AMAZON_PARTNER_TAG_DE`, and
`AMAZON_PARTNER_TAG_CA`. Generation **fails closed** — an unconfigured
marketplace produces an explicit error, never an untagged or placeholder
link.

### Discovery Flow

1. **Search**: Each enabled source is queried with configured search terms
2. **Enrich**: Full product details are fetched via source-specific detail endpoints
3. **Normalize**: Images, descriptions, affiliate URLs, and metadata are normalized
4. **Deduplicate**: Products are upserted using `(source, source_id)` unique constraint
5. **Store**: All data persisted to `products` table with `images`, `video_url`, `metadata`, and `affiliate_links` JSONB

### Media & Affiliate Storage

- **Primary image**: Stored in `image_url` column
- **Additional images/videos**: Stored in `images` TEXT[] array
- **Video URL**: Stored in `video_url` column
- **Affiliate links**: Stored in `affiliate_links` JSONB with source-specific keys
- **Raw metadata**: Stored in `metadata` JSONB for source-specific fields

### Running Discovery

```bash
# Discovery runs via the /api/cron/product-discovery endpoint
# (Vercel Cron, every 6 hours — see vercel.json)
# The endpoint invokes runProductDiscovery() from @thinkabell/jobs,
# which uses advisory lock 1004 to prevent concurrent runs
```

---

## 📊 Current Metrics

| Metric | Value |
|---|---|
| **Packages** | 6 (@thinkabell/config, database, shared, edge-worker, @thinkabell/web, @thinkabell/jobs) |
| **Test Coverage** | 482 tests, all passing |
| **TypeScript** | Strict mode, all packages passing `tsc --noEmit` |
| **Lint** | All packages clean |
| **Database Tables** | 10+ tables with RLS, indexes, and seed data |
| **API Routes** | 10+ endpoints (retailer-links, sponsored, click tracking, health, subscribe, search, compare, cron, route-link, alerts, contact) |
| **Background Jobs** | 5 runners (fetchPrices, sendAlerts, deadLetterRetry, monitorJobRuns, productDiscovery) with circuit breakers, DND, advisory locks |
| **UI Components** | 15+ components (DealCard, CompareTable, CompareToggle, CompareBar, CompareProvider, PriceHistoryChart, TransparencyBanner, DealCountdown, PromoCodeCopy, PriceFreshnessBadge, AlertQualityScore, CookieConsent, SubscribeModal, SubscribeCTA, TrueCostCalculator, Navbar, Footer, ErrorBoundary, Skeletons) with production-grade error handling and loading states |
| **Pages** | Homepage, Deal Detail, Product Comparison, True Cost Calculator, Subscribe, Search, Legal (Privacy, Terms), Unsubscribe Confirmed, Not Found |
| **SaaS Integrations** | PartnerStack, AppSumo, Impact clients with fail-closed behavior |
| **Structured Data** | Product, BreadcrumbList, SpeakableSpecification, WebSite JSON-LD |
| **Compliance** | FTC disclosure, rel="sponsored" coverage (98 passed), privacy policy, unsubscribe headers |

---

## 📦 Deployment Guides

- **Hostinger Node.js Hosting**: See [docs/HOSTINGER_DEPLOYMENT.md](docs/HOSTINGER_DEPLOYMENT.md).
- **Cloudflare CDN & Edge Worker**: See [docs/CLOUDFLARE_SETUP.md](docs/CLOUDFLARE_SETUP.md).
- **Uptime Monitoring & Health Checks**: See [docs/UPTIME_MONITORING.md](docs/UPTIME_MONITORING.md).
- **Launch & Marketing Playbook**: See [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md).
- **Pre-Launch Audit Report**: See [docs/PRE_LAUNCH_AUDIT.md](docs/PRE_LAUNCH_AUDIT.md).

---

## 🔒 Security & Compliance

- **Row Level Security (RLS)** is enforced on all Supabase tables.
- **Fail-Closed Clients**: Every SaaS/affiliate/notification client throws when credentials are missing — including the Supabase client (`getSupabaseAnonClient`/`getSupabaseServiceClient`), which refuses to construct a client against an unconfigured project instead of silently using placeholder credentials.
- **Affiliate Disclosure**: Meets Amazon Associates Operating Agreement and FTC requirements.
- **Rate Limiting**: Sliding-window rate limiting with fail-closed behavior on all public endpoints.
- **Content Security**: Per-request CSP with cryptographic nonce (generated in `middleware.ts`, applied to inline JSON-LD scripts); HSTS, Permissions-Policy, X-Frame-Options in `next.config.js`.
- **No Placeholder Data**: Pages render honest empty/not-found states when the database is unavailable rather than serving hardcoded mock deals.
- **Brevo Compliance**: `List-Unsubscribe` header in all transactional emails.
- **Cookie Consent**: Consent-gated tracker initialization for GDPR/CCPA; PostHog and OneSignal SDKs only initialize after explicit consent.
- **Data Retention**: Automated archival jobs for `price_history` (2 years), `click_tracking` (1 year), `alert_queue` (90 days), `dead_letter_queue` (30 days).
- **Circuit Breaker**: Redis-backed state persistence with auto-load on construction for serverless compatibility.

---

## 🤝 Contributing

See `agent.md` for the full implementation plan, expert reviews, board directives, and sprint roadmap.

1. Review `agent.md` for current sprint tasks and priorities.
2. Ensure `pnpm type-check`, `pnpm lint`, and `pnpm test` pass before committing.
3. Follow existing code conventions: TypeScript strict, Tailwind utilities, repository pattern.

---

&copy; ThinkaBell (`thinkabell.click`). Built with TypeScript, Next.js, Supabase, Vercel Cron, and Cloudflare.
