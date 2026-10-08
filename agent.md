# ThinkaBell Implementation Plan

## Current State Summary
- **Monorepo scaffolded**: pnpm workspaces, Turborepo, TypeScript strict, ESLint, Prettier, Vitest
- **Packages exist**: `config` (Zod env with `resetEnv()` for test isolation), `database` (Supabase client + schema with `search_vector` TSVECTOR, GIN index, RLS), `shared` (Amazon, eBay, Walmart, OneSignal, Brevo, Redis, rate limiter, circuit breaker, retry, logger)
- **Jobs exist**: `fetchPrices` (per-subscriber model, circuit breaker, DND, dead-letter handling), `sendAlerts` (per-subscriber model with quality scoring)
- **Frontend exists**: Homepage, search API (`/api/search` with full-text search), search page, deal detail page (SaaS + physical dual-track), subscribe page, health API, sitemap, robots
- **CI/CD exists**: GitHub Actions deploy workflow for Hostinger
- **Completed**: Brevo email, SaaS sources (simulation mode), Walmart integration, trust metrics, alert quality score UI, daily digest, dead-letter queue, search API with full-text search, compatibility badges, Amazon manual-list product hunting (`amazon-list` discovery source with public-list harvesting, modular `amazonAffiliateLinkGenerator` with fail-closed regional partner tags, no Amazon login credentials used or stored), edge geo-routing wired end-to-end (Cloudflare worker + origin-side `/go/amazon/:asin` parity route, geo-aware deal/true-cost CTAs and commission routing via `packages/shared/src/api/georouter.ts`, spoof-resistant via `EDGE_PROXY_TRUSTED`)
- **Remaining**: Design-system primitives deferred to post-launch; SaaS data source real API integration deferred. True-cost page, compliance CI legal gate, business case addendum, 12-month P&L, and DPA review docs have landed.

---

## Key Data Model Decisions

- **`products.category`**: `'physical' | 'software'` — classifies the product type
- **`products.sources`**: `TEXT[]` — list of data-source identifiers that should be checked for this product, e.g. `['ebay']`, `['walmart']`, `['partnerstack']`, `['appsumo']`, `['impact']`
- **`products.affiliate_network`**: single primary network for the canonical link, used for routing and trust scoring
- **Alert queue**: per-subscriber rows. `alert_queue.subscriber_id` is non-null after migration. Legacy broadcast rows (no `subscriber_id`) are migrated out-of-band.
- **Sentiment**: store Reddit summary text and mention metadata only; do not store numeric sentiment score in MVP.
- **Comparison**: deterministic rubric stored in code, not editorial judgment; log outcomes to append-only audit table.

---

## Expert Review & Recommendations

| # | Expert | Priority | Key Recommendations |
|---|--------|----------|---------------------|
| 1 | **Product/Business Strategist** | 🔴 Critical | Focus SaaS-first but keep physical as traffic driver. Add early monetization via clearly labeled premium placements. Defer watchlists to post-MVP. |
| 2 | **CTO/Solution Architect** | 🔴 Critical | Service-role client for all job writes. Circuit breaker pattern for external APIs. Trigger.dev job monitoring. |
| 3 | **Full-Stack Engineer** | 🔴 Critical | Clear visual distinction between SaaS/physical tracks. Loading skeletons. Search returns minimal fields. |
| 4 | **Data Engineer** | 🔴 Critical | Supabase migrations for schema changes. JSONB validation for `affiliate_links`. `fetchPrices` must upsert, not insert. |
| 5 | **Web Scraping/Data Acquisition Engineer** | 🔴 Critical | Circuit breaker: 5 failures → pause 1 hour. User-agent rotation. Proxy strategy for eBay/Walmart if IP-blocked. |
| 6 | **AI/ML Engineer** | 🟠 High | Simple fuzzy matching for cross-retailer deduplication. Keyword-based sentiment for MVP; upgrade to ML later. |
| 7 | **Price Intelligence Specialist** | 🔴 Critical | Normalize all prices to USD. 90-day price history retention. Alert thresholds: default 10%, per-user customization. |
| 8 | **Product/Software Research Analyst** | 🔴 Critical | SaaS testing: free trial, feature limits, support quality. Comparison criteria: pricing, features, integrations, reliability. |
| 9 | **Editorial/Technical Writer** | 🟠 High | Standardize deal description templates. "Best X for Y" buying guides. Pros/cons/verdict format. |
| 10 | **SEO/AEO/GEO Specialist** | 🟠 High | `FAQPage` and `HowTo` structured data. AI-search summaries at top of deal pages. Internal linking between related products. |
| 11 | **UX/UI + Product Designer** | 🟠 High | Transparency banner above the fold. Clear SaaS vs physical visual distinction. Empty states for search. Mobile-first deal page. |
| 12 | **Legal/Compliance/Privacy Specialist** | 🔴 Critical | Affiliate disclosure "clear and conspicuous" per FTC. OneSignal requires push consent. Privacy policy and ToS required. |
| 13 | **Affiliate Marketing Expert** | 🔴 Critical | Never override cookies. Never accept pay-for-play. Track conversion by network. Disclose affiliate relationship prominently. |
| 14 | **Comparative Engine Expert** | 🟠 High | "Best for" badges based on category analysis. Side-by-side comparison feature (post-MVP). Price normalization across retailers. |
| 15 | **Sentiment Analyst Designer** | 🟠 High | Reddit sentiment: simple keyword scoring for MVP. Store summary, not raw data. Visual sentiment indicator on deal page. |
| 16 | **Principal Product Designer** | 🔴 Critical | Split UX into two distinct experiences. SaaS emphasizes trial/transparency; physical emphasizes compatibility/price history. Progressive disclosure in subscribe flow. |
| 17 | **UX Architect** | 🔴 Critical | Consolidate discovery into `/deals` with filters. Move subscribe to inline modal. Add `/alerts` dashboard for preference management. |
| 18 | **Design-System Engineer** | 🟠 High | Define design tokens in Tailwind before building components. Create `components/ui/` primitives. All deal-page components extend base primitives. |
| 19 | **Frontend UX Engineer** | 🔴 Critical | ISR revalidation conflicts need handling. Client-side "last verified" must match server data. Add loading skeletons and error boundaries. |
| 20 | **Accessibility Specialist** | 🔴 Critical | Color badges must include text/icon indicators. PromoCodeCopy needs `aria-live` announcement. Skip links on all pages. Test with axe DevTools in CI. |
| 21 | **SEO/AEO UX Strategist** | 🟠 High | Add 1-2 sentence TL;DR block for AI search consumption. Breadcrumb structured data. `speakable` schema for voice search. Topic clusters around categories. |
| 22 | **Visual QA Engineer** | 🟠 High | Add visual regression tests for deal pages in both SaaS/physical states. Test at 320px, 768px, 1024px, 1440px. Screenshot comparison for key components. |
| 23 | **Backend Expert** | 🔴 Critical | Supabase connection pooling. `sendAlerts` N+1 query risk - batch-fetch subscribers. Add indexes on `alert_queue(subscriber_id, sent)` and `products(sources)`. |
| 24 | **Affiliate Marketing Expert** | 🔴 Critical | Affiliate links must be direct, no redirect chains. Disclosure within first 100px of deal page. `rel="sponsored"` on all affiliate links. Geo-based link routing. Track clicks via `/api/out?url=`. |
| 25 | **Comparative Engine Expert** | 🟠 High | Define "Best for" criteria explicitly. Create `comparisons` table for post-MVP. For MVP, show "Also consider" section instead of full comparison. |
| 26 | **Sentiment Analyst Designer** | 🟠 High | Display sentiment as 3-state indicator (Positive/Mixed/Negative) with 1-sentence summary. Do not show numeric scores in MVP - false precision. |
| 27 | **Platform/Infrastructure Architect** | 🔴 Critical | Cloudflare cache rules: static 1 day, HTML 5 min, API 1 min. Add `/api/health` endpoint. Trigger.dev `maxDuration` and `retry` config. Queue-based processing for alert spikes. |
| 28 | **Backend Infrastructure Specialist** *(new)* | 🔴 Critical | Amazon PA-API has a 10-sales/30-day eligibility gate — new accounts get `AssociateNotEligible 403`. Start with eBay Browse API; add third-party scraping API (Canopy/Rainforest/ScrapingBee) as Amazon fallback. Manual curation for first 50–100 products until PA-API eligibility is earned. |
| 29 | **Affiliate Marketing Expert** *(enhanced)* | 🔴 Critical | Create `retailer_links` table. Route to retailer with highest effective commission (`price × commission_rate`), with tie-breaker to Amazon. Enforce `rel="sponsored"` at component-primitive level. Add `/api/route-link` endpoint. |
| 30 | **Business Viability Analyst** *(new)* | 🟠 High | First-year affiliate average: $636/month; 95% of beginners fail. Physical electronics commissions: 1–4%; SaaS commissions: 20–60% recurring. Do not project meaningful physical revenue in year one. Expect 12–18 months to meaningful revenue. |
| 31 | **SEO/AEO Specialist** *(new)* | 🟠 High | Programmatic SEO at scale (10k pages) will trigger Google's 2025/2026 low-quality content filters. Apply `noindex` to thin pages; only index pages receiving organic traffic or backlinks. Prioritize topical authority over page count. |
| 32 | **Notification Systems Specialist** *(new)* | 🟠 High | OneSignal free tier: 1,000 MAU mobile push, 10,000 web push. MailerLite cut to 250 subscribers / 2,500 emails/month. Use web push as primary channel. Migrate to Brevo (300 emails/day = 9,000/month free). Diversify to Telegram/Discord/RSS as zero-cost backup channels. |
| 33 | **CEO/Board Director** *(new)* | 🔴 Critical | 6-week timeline unrealistic for current scope. Slash Sprint 0 to 2-week hard stop; defer design system, S2S postbacks, comparison tables, visual QA pipeline, sentiment infrastructure to post-launch. Launch manual-curation MVP to 50 beta users within 3 weeks to validate acquisition cost and conversion. Add 2-page business-case addendum with competitive positioning, unit economics, capital requirements, and 4 board-level Go/No-Go checkpoints. |
| 34 | **CFO / Finance Director** *(new)* | 🔴 Critical | No revenue model or break-even analysis; hidden costs not aggregated; physical-product work built despite year-one non-performance; notification cost ceilings unaddressed. Build 12-month P&L with 3 scenarios; defer physical-product UI/data-source work to Sprint 3 or post-MVP; replace Trigger.dev with Vercel Cron/Supabase pg_cron; define 3 platform service tiers ($9/$29/$79/mo); establish $0 paid notification/infra budget until MRR hits $500; require SaaS affiliate conversion tracking to validate commission assumptions. |
| 35 | **Legal/Compliance Director** *(new)* | 🔴 Critical | Missing GDPR/CCPA lawful-basis framework and DPA strategy; Reddit scraping legal risk; no unified data retention/erasure workflow; no cookie-consent mechanism; no compliance checks in CI. Pre-Sprint 0: draft privacy policy and terms of service; add geo-IP-based privacy routing with cookie-consent banner; halt Reddit scraping until legal review; define unified data-retention schedule with automated archival/deletion; encode legal checks in CI (rel="sponsored", FTC disclosure, privacy-policy links, Brevo unsubscribe header); add DPA review for Brevo/OneSignal/Redis before EU/UK launch. |
| 36 | **Security Director / CISO** | ⚫ PENDING | Output not yet available. |
| 37 | **CTO / Technical Director** | ⚫ PENDING | Output not yet available. |

---

## Expert Critical Analysis

*(Full expert critical analysis sections retained as-is from original plan — Principal Product Designer, UX Architect, Design-System Engineer, Frontend UX Engineer, Accessibility Specialist, SEO/AEO UX Strategist, Visual QA Engineer, Backend Expert, Affiliate Marketing Expert, Comparative Engine Expert, Sentiment Analyst Designer, Platform/Infrastructure Architect.)*

### CEO/Board Director *(new)*
- **Finding:** 6-week timeline is unrealistic for the current scope. No business case, unit economics, or Go/No-Go gates exist. Physical-product infrastructure is being built despite year-one non-performance projections.
- **Recommendations:**
  - Slash Sprint 0 to a 2-week hard stop; defer design system, S2S postbacks, comparison tables, visual QA pipeline, and sentiment infrastructure to post-launch
  - Launch a manual-curation MVP to 50 beta users within 3 weeks to validate acquisition cost and conversion before building more automation
  - Add 2-page business-case addendum with competitive positioning, unit economics, capital requirements, and 4 board-level Go/No-Go checkpoints

### CFO / Finance Director *(new)*
- **Finding:** No revenue model or break-even analysis. Hidden costs are not aggregated. Physical-product UI and data-source work is being built despite year-one non-performance projections. Notification cost ceilings are unaddressed.
- **Recommendations:**
  - Build 12-month P&L with 3 scenarios (conservative / base / aggressive) before Sprint 1 begins
  - Defer physical-product UI and data-source work to Sprint 3 or post-MVP; focus automation exclusively on SaaS sources first
  - Replace Trigger.dev with Vercel Cron or Supabase `pg_cron` to eliminate job-runner license costs
  - Define 3 platform service tiers ($9/$29/$79/mo) with clear feature differentiation
  - Establish a $0 paid notification and infrastructure budget until MRR hits $500
  - Require SaaS affiliate conversion tracking to validate commission assumptions before scaling spend

### Legal/Compliance Director *(new)*
- **Finding:** Missing GDPR/CCPA lawful-basis framework and DPA strategy. Reddit scraping carries unassessed legal risk. No unified data retention/erasure workflow. No cookie-consent mechanism. No compliance checks in CI.
- **Recommendations:**
  - **Pre-Sprint 0**: Draft and publish privacy policy and terms of service
  - Add geo-IP-based privacy routing with cookie-consent banner (OneTrust/Cookiebot or self-hosted)
  - Halt Reddit scraping until legal review confirms permissible use under platform Terms and applicable law
  - Define unified data-retention schedule with automated archival/deletion jobs
  - Encode legal checks in CI: `rel="sponsored"` on all affiliate links, FTC disclosure above the fold on deal pages, privacy-policy links in footer, Brevo unsubscribe header in all email templates
  - Complete DPA review for Brevo, OneSignal, and Redis before launching in EU/UK markets

### Security Director / CISO
- **Finding:** [PENDING — output not yet available]
- **Recommendations:** [PENDING — extract when output is received]

### CTO / Technical Director
- **Finding:** [PENDING — output not yet available]
- **Recommendations:** [PENDING — extract when output is received]

---

## Alert Queue Model

**Chosen: Per-subscriber.** One `alert_queue` row per (product + subscriber). Enables per-subscriber Alert Quality Score, DND hours, dead-letter queue, and daily digest tracking. With 100–1,000 subscribers this produces manageable row counts.

**Data flow change:**
- Old (broadcast): `fetchPrices` creates 1 alert row per price drop → `sendAlerts` loops all subscribers in memory
- New (per-subscriber): `fetchPrices` queries matching subscribers and creates 1 row per (product, subscriber) → `sendAlerts` processes each row directly without subscriber filtering

**Migration:** Existing broadcast rows (no `subscriber_id`) are legacy.
1. Add `subscriber_id INT NULL` to `alert_queue`
2. Backfill or discard legacy rows
3. Add `NOT NULL` constraint
4. `fetchPrices` populates per-subscriber rows going forward

---

## Consolidated High-Priority Additions

These items emerged from board and expert review and are NOT already in the sprint plan:

1. **12-month P&L with 3 scenarios (conservative/base/aggressive)** — required by CFO before Sprint 1; informs capital requirements and Go/No-Go checkpoint 2
2. **3 platform service tiers ($9/$29/$79/mo)** — priced per CFO guidance; feature matrix to be defined in business-case addendum
3. **$0 paid notification and infrastructure budget until MRR ≥ $500** — hard ceiling; all infra within free tiers until revenue gate is cleared
4. **Replace Trigger.dev entirely with Vercel Cron + Supabase `pg_cron`** — eliminates recurring job-runner license cost; already partially addressed in Sprint 0.9 but now mandatory, not optional
5. **Defer physical-product UI and data-source work to Sprint 3 or post-MVP** — focus automation exclusively on SaaS sources in Sprints 1–2 per CFO and CEO guidance
6. **Defer design-system primitive library to post-launch** — CEO mandates 2-week Sprint 0 hard stop; deal-page styling uses Tailwind utility classes directly for MVP; design tokens and `DealPageShell` composite deferred to post-launch Sprint 4+
7. **Defer S2S postback/webhook ingestion to post-MVP** — click-tracking endpoint built in Sprint 2, but S2S conversion reconciliation deferred; commission assumptions validated via dashboard analytics first
8. **Defer comparison tables (full side-by-side) to post-MVP** — MVP uses deterministic "Also consider" algorithm only; `comparisons` table schema exists in Sprint 0 but editorial comparison pages deferred
9. **Defer visual QA pipeline to post-launch** — Playwright visual regression tests deferred from Sprint 3 to post-launch Sprint 4+
10. **Defer sentiment infrastructure to post-launch** — MVP stores Reddit summary text only; keyword-scoring pipeline and 3-state indicator deferred to post-launch; deal pages show "Sentiment data coming soon" placeholder
11. **Privacy policy and terms of service published before Sprint 0** — Legal Director mandates pre-Sprint 0 delivery; both pages must be live before any user-facing beta
12. **Cookie-consent banner + geo-IP privacy routing before Sprint 0** — required for GDPR/CCPA compliance; blocks EU/UK traffic until consent is obtained
13. **Halt Reddit scraping until legal review is complete** — Legal Director finding; no Reddit data ingestion in any sprint until DPA/legal clearance obtained
14. **Unified data-retention schedule with automated archival/deletion** — define retention periods per data class; implement archival/deletion jobs before EU/UK launch
15. **Compliance checks encoded in CI** — automated gate for `rel="sponsored"`, FTC disclosure placement, privacy-policy link presence, Brevo unsubscribe header; must pass before any deploy to production
16. **DPA review for Brevo, OneSignal, Redis before EU/UK launch** — Legal Director requirement; documented DPA signatures required before processing EU/UK personal data
17. **SaaS affiliate conversion tracking required before scaling spend** — CFO mandate; `/api/route-link` click data must be reconciled against actual network conversion reports before paid notification budget is released
18. **Manual curation of 50–100 products as primary content source** — CEO and Backend Infrastructure Specialist mandates; no PA-API dependency until eligibility earned; eBay Browse API as primary source with optional third-party scraping API fallback
19. **2-page business-case addendum before Sprint 1** — CEO requirement; covers competitive positioning, unit economics, capital requirements, and 4 board-level Go/No-Go checkpoints

---

## Board-Level Strategic Adjustments

The following adjustments are mandated by the CEO/Board, CFO, and Legal/Compliance reviews. They take precedence over the original sprint timeline and scope.

### Timeline Adjustment: Sprint 0 → 2-Week Hard Stop

Sprint 0 is restructured as a 2-week hard stop with an explicit deferral list. The original 6-week all-up timeline is replaced by a **3-week beta gate** followed by a board Go/No-Go review before Sprint 2 work commences.

**2-week Sprint 0 deliverables only:**
1. Remove WooCommerce artifacts (0.1)
2. Switch email from MailerLite to Brevo (0.2)
3. Fix job database clients to use service role (0.3)
4. Schema migration + bug fixes: add `subscriber_id` to `alert_queue`, `increment_alert_attempt` RPC, `comparison_criteria`/`comparisons`/`comparison_audit`/`comparison_disputes` tables, indexes, RLS policies (0.4)
5. `fetchPrices` per-subscriber rewrite with batch INSERT + circuit breaker + job locking (0.5 + 0.6 combined)
6. Data source abstraction with eBay Browse API as primary; third-party scraping API as Amazon fallback; no PA-API calls until eligibility confirmed (0.8)
7. Replace Trigger.dev with Vercel Cron / Supabase `pg_cron` for all job scheduling (0.9)
8. `retailer_links` table + `/api/route-link` endpoint (0.10)
9. Notification service audit: confirm Brevo + OneSignal web push primary + Telegram/Discord backup wired (0.11)

**Explicitly deferred out of Sprint 0 (post-launch / Sprint 4+):**
- Design-system token namespaces and primitive component library (`Button`, `Badge`, `Card`, `Skeleton`)
- `DealPageShell` composite component and MDX API contracts
- Visual QA pipeline (Playwright visual regression tests)
- Sentiment infrastructure (Reddit keyword-scoring pipeline, 3-state indicator computation)
- S2S postback/webhook ingestion for affiliate conversion reconciliation

### MVP Scope Reduction: Manual-Curation Beta to 50 Users Within 3 Weeks

- Accept only 50 beta users via manual invite list or waitlist signup (no public launch)
- Content is 50–100 manually curated products (not auto-ingested from Amazon PA-API)
- Primary data source is eBay Browse API; Amazon data via third-party scraping API only if scraping API is available at launch
- No Reddit sentiment scraping until legal review clears it
- Goal of beta: validate acquisition cost (CAC), store-to-alert conversion (>15% target), and alert-to-store CTR (>10% target)
- Board Go/No-Go checkpoint 1 fires at end of Week 3 based on beta metrics

### Business Case Requirement: 2-Page Addendum Before Sprint 1

A 2-page business-case addendum must be drafted and board-approved before any Sprint 1 work begins. It must contain:
- **Competitive positioning**: direct and indirect competitors; differentiation thesis
- **Unit economics**: CAC, LTV, commission rates by category (SaaS vs physical), break-even subscriber count
- **Capital requirements**: 12-month cash need at $0 paid infra (free tiers only) vs. paid-tier escalation path
- **4 board-level Go/No-Go checkpoints**:
  1. **Week 3 (Beta Launch)**: 50 beta users onboarded; CAC ≤ target; ≥10% store-to-alert conversion
  2. **Month 3**: MRR ≥ $500 (unlock paid infra/notification budget); ≥100 active subscribers
  3. **Month 6**: MRR ≥ $2,000; LTV:CAC ≥ 3:1; PA-API eligibility earned or scraping API EPC validated
  4. **Month 12**: MRR ≥ $5,000; SaaS commission revenue ≥ 80% of total; path to profitability within 18 months confirmed

### Financial Guardrails

- **$0 paid notification and infrastructure budget until MRR hits $500** — all services must operate within free tiers (Brevo 9,000 emails/month, OneSignal web push 10,000 subscribers, Supabase free tier, Redis cloud free tier or self-hosted)
- **12-month P&L with 3 scenarios** (conservative/base/aggressive) must be finalized before Sprint 1; shared with all engineering leads
- Physical-product data-source and UI work is deferred to Sprint 3 or post-MVP; year-one revenue projection for physical is $0
- SaaS affiliate conversion tracking via `/api/route-link` click logs vs. network conversion reports must be reconciled monthly; commission assumptions are invalidated if reconciliation gap exceeds 20%

### Legal Pre-Work: Before Sprint 0 Starts

The following items are blocking prerequisites. Sprint 0 does not begin until they are complete:
1. **Privacy policy** published at `/privacy-policy` covering: data collected, lawful basis per GDPR Art. 6, retention periods, user rights (access, erasure, portability), DPO contact
2. **Terms of service** published at `/terms-of-service` covering: acceptable use, affiliate disclosure obligation, liability limits, dispute resolution
3. **Cookie-consent banner** implemented: geo-IP detection routes EU/UK visitors to consent flow before any tracker fires; consent state stored in cookie with 12-month TTL
4. **Data-retention schedule** defined and documented: `alert_queue` 90 days, `price_reports` 90 days, `dead_letter_queue` 30 days, `job_runs` 90 days, subscriber profiles retained until deletion request
5. **Reddit scraping halted** until legal review confirms: (a) permissible under Reddit API Terms, (b) GDPR/CCPA data-subject obligations are met, (c) data-processing agreement with any third-party sentiment provider is signed
6. **DPA review completed** for Brevo (EU data processing), OneSignal (EU data processing), and Redis (if Redis Cloud is used with EU data)

### Compliance CI Gates

The following checks must pass in CI before any PR can be merged to `main` or deployed to production:
1. **`rel="sponsored"` enforcement**: automated scan of all rendered `<a>` tags with `href` matching affiliate network domains; fail build if any affiliate link lacks the attribute
2. **FTC disclosure check**: automated scan of deal page templates confirms disclosure block is present in the first 200px of rendered HTML
3. **Privacy-policy link check**: automated scan of footer and legal pages confirms `/privacy-policy` link exists on every page template
4. **Brevo unsubscribe header check**: automated scan of email template code confirms `List-Unsubscribe` header is set in all Brevo API call payloads
5. **Cookie-consent gate check**: automated E2E test confirms no tracker scripts fire before consent is given for geo-IP-detected EU/UK sessions

---

## Sprint 0: Foundation (2-Week Hard Stop)

**Validation gates (all must pass before Sprint 0 is considered complete):**
- `pnpm type-check` passes
- `pnpm test` passes
- Privacy policy and ToS are live and accessible
- Cookie-consent banner is functional in EU/UK geo-IP test
- `/api/health` endpoint returns 200 with DB + Redis connectivity confirmed
- 50 manually curated products seeded in Supabase
- Brevo test email delivers successfully
- OneSignal web push subscription flow works end-to-end
- No Reddit scraping code is executed (halting gate enforced)

### 0.1 Remove WooCommerce (Day 1)
1. Move `thinkabell-woo/` to `thinkabell-woo-backup-YYYYMMDD/`
2. Remove WooCommerce references from `agent.md`
3. Verify no references in `.ts`, `.js`, `.json`, `.md`, `.yml` files
4. Verify `pnpm type-check` passes

### 0.2 Switch Email to Brevo (Day 1)
1. Update `packages/config/src/env.ts`: replace `MAILERLITE_API_KEY` with `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`
2. Update `packages/shared/src/api/notificationClient.ts`: replace MailerLite endpoint with Brevo (`https://api.brevo.com/v3/smtp/email`, `sender: { email, name }` payload)
3. Update `.env.example`: replace MailerLite vars with Brevo vars
4. Update `agent.md`: replace MailerLite references

### 0.3 Fix Job Database Clients (Security) (Day 1–2)
1. Update `apps/jobs/src/jobs/fetchPrices.ts`: import `getSupabaseServiceClient` from `@thinkabell/database`; replace all `supabase` write calls with `serviceClient`
2. Update `apps/jobs/src/jobs/sendAlerts.ts`: same replacement
3. Verify `alertRepository.ts` already uses `getSupabaseServiceClient()` (it does)

### 0.4 Schema Migration + Bug Fixes (Day 2–5)
1. Update `packages/database/schema.sql`:
   - Add columns to `products`: `deal_type`, `deal_start_date`, `deal_end_date`, `promo_code`, `original_price`, `discount_percent`, `affiliate_network`, `affiliate_id`, `sources`
   - Add columns to `alert_queue`: `subscriber_id INT REFERENCES subscribers(id) ON DELETE CASCADE`, `alert_quality_score INT CHECK (alert_quality_score BETWEEN 0 AND 100)`, `failed_at TIMESTAMPTZ`, `error_message TEXT`
   - Add missing `increment_alert_attempt` RPC function
   - Add tables: `price_reports`, `job_runs`, `dead_letter_queue`, `watchlists`, `comparison_criteria`, `comparisons`, `comparison_audit`, `comparison_disputes`, `retailer_links`
   - Add indexes: `idx_products_deal_type`, `idx_products_verified`, `idx_alert_queue_subscriber`, `idx_products_sources`
   - Add RLS policies for new tables
2. Update `packages/database/src/types.ts` with new column types
3. Add `increment_alert_attempt` RPC body to `schema.sql`
4. **Data Engineer**: Add Supabase migration file for schema changes (not raw SQL only)
5. **Data Engineer**: Add JSONB validation for `affiliate_links` shape in API routes

### 0.5 Fix `fetchPrices` for Per-Subscriber Model (Day 4–8)
1. Add `DealSource` interface to `packages/shared/src/types/index.ts`
2. Update `apps/jobs/src/jobs/fetchPrices.ts`:
   - Import `getSupabaseServiceClient`; use it for all writes
   - Query all products matching `sources` array; route by source type (eBay Browse API for physical; PartnerStack/AppSumo/Impact for SaaS — simulation mode acceptable for Sprint 0)
   - Fetch matching subscribers whose preferences match the product's `category` and whose `min_discount_percent` is met
   - Batch insert per-subscriber `alert_queue` rows using single `INSERT ... SELECT`
   - Normalize prices to USD; keep 90-day history in `price_reports`
   - Dedup key: `alert_sent:{subscriber_id}:{product_id}` with 24h Redis TTL
   - **Circuit breaker**: after 5 consecutive failures for a source, pause that source for 1 hour
3. Update `scripts/seed-50-products.ts`: seed 30+ SaaS products + 20+ physical with correct `sources` arrays (manual curation, not auto-imported from PA-API)
4. **Backend Infrastructure Specialist**: No Amazon PA-API call is made unless eligibility is confirmed; use eBay Browse API as primary source for MVP

### 0.6 Job Locking + Circuit Breaker (Day 5–9)
1. Create `packages/shared/src/utils/retryWithBackoff.ts`
2. Wrap ALL external API calls in `fetchPrices.ts` with exponential backoff (base 1s, max 30s, max 3 retries)
3. Add circuit breaker state (in-memory or Redis): after 5 consecutive failures for a source, pause that source for 1 hour
4. **Backend Expert**: Add distributed locking for `fetchPrices` and `sendAlerts`:
   - Preferred: PostgreSQL advisory lock (`pg_try_advisory_lock`) held for the duration of the job run
   - Fallback: Vercel Cron `maxConcurrency: 1` semantics (single in-flight invocation)
5. Add `job_runs` table and log every job execution with status, row count, and duration

### 0.7 Replace Trigger.dev with Vercel Cron / Supabase `pg_cron` (Day 6–10)
1. Remove Trigger.dev from `turbo.json`, `package.json`, and CI workflow
2. Add Vercel Cron configuration in `vercel.json` OR Supabase `pg_cron` schedule for:
   - `fetchPrices`: every 6 hours (implemented: `0 */6 * * *` in `vercel.json`)
   - `sendAlerts`: every 6 hours (implemented: `0 */6 * * *` in `vercel.json`)
   - `productDiscovery`: every 6 hours (implemented: `0 */6 * * *` in `vercel.json`, endpoint `/api/cron/product-discovery`)
   - `expireDeals`: hourly
   - `sendDailyDigest`: daily at configurable time
3. Verify all job entry points in `apps/jobs/src/` are callable as serverless functions (no Trigger.dev SDK dependencies)
4. Remove Trigger.dev dashboard references from `agent.md` and README
5. **CFO**: Confirm zero job-runner license cost in 12-month P&L

### 0.8 `retailer_links` Migration + `/api/route-link` (Day 7–10)
1. **Affiliate Marketing Expert**: Add `retailer_links` table to `schema.sql` with `product_id`, `retailer`, `affiliate_url`, `commission_rate`, `current_price`, `last_checked`
2. Add unique constraint on `(product_id, retailer)`
3. Add indexes and RLS policies
4. Update `packages/database/src/types.ts` with new types
5. Create `apps/web/app/api/route-link/route.ts`: accepts `product_id`, looks up `retailer_links`, routes to highest effective commission retailer with Amazon tie-breaker, logs click to `click_events` table
6. Add `rel="sponsored"` enforcement at the `Link` component primitive level
7. Inline disclosure text adjacent to every affiliate CTA in search results and deal page

### 0.9 Notification Service Audit (Day 8–10)
1. Confirm all MailerLite references are fully replaced with Brevo
2. Document OneSignal web push 10,000 subscriber free limit vs. 1,000 MAU mobile push limit
3. Add Telegram bot webhook configuration as zero-cost backup channel
4. Add Discord webhook configuration as secondary zero-cost backup channel
5. Confirm Brevo test email delivers with `List-Unsubscribe` header
6. **CFO**: Document $0 paid notification cost path in 12-month P&L

### 0.10 Compliance Pre-Work Verification (Day 9–10, blocking)
1. **Legal/Compliance Director**: Confirm privacy policy and ToS are published and accessible
2. **Legal/Compliance Director**: Confirm cookie-consent banner blocks EU/UK tracker scripts until consent
3. **Legal/Compliance Director**: Confirm Reddit scraping code is gated behind a feature flag set to `false` in all environments
4. **Legal/Compliance Director**: Confirm data-retention schedule is documented and approved
5. Add CI compliance checks (see Compliance CI Gates section above)
6. **Legal/Compliance Director**: Confirm DPA review status for Brevo, OneSignal, Redis is documented

### 0.11 `sendAlerts` Per-Subscriber Rewrite (Day 10–14)
1. Rewrite `apps/jobs/src/jobs/sendAlerts.ts`:
   - Use `getSupabaseServiceClient()` for all queries and writes
   - Query `alert_queue` where `sent = false`, limit 50, JOIN with `products` and `subscribers`
   - Re-validate each alert against current subscriber preferences before dispatch
   - Check DND hours: queue for later if in DND window
   - Check Redis dedupe: `alert_sent:{subscriber_id}:{product_id}` (TTL 24h)
   - Send push (OneSignal) + email (Brevo), mark `sent = true`, increment `attempts`
   - On failure: increment `attempts` via RPC, if `>= 3` move to `dead_letter_queue`
2. Add `dead_letter_queue` table (already in 0.4 schema)
3. **Backend Expert**: Batch-fetch subscribers by IDs; add unique constraint on `alert_queue(subscriber_id, product_id, created_at)`

---

## Deferred to Post-Launch (Sprint 4+)

The following items are explicitly deferred by CEO/Board mandate or by scope-reduction requirements. They are not forgotten — they are parked for the post-MVP roadmap.

| Item | Reason Deferred | Owner |
|------|----------------|-------|
| Design-system token namespaces + primitive library | 2-week Sprint 0 hard stop; Tailwind utilities sufficient for MVP | Design-System Engineer |
| `DealPageShell` composite component + MDX API contracts | Dependent on design-system foundation; deferred | Design-System Engineer |
| Visual QA pipeline (Playwright visual regression) | Post-launch quality hardening; MVP ships without automated visual diffs | Visual QA Engineer |
| Sentiment infrastructure (Reddit keyword-scoring pipeline) | Legal review required; MVP stores summary text only | Sentiment Analyst Designer |
| S2S postback/webhook ingestion for affiliate networks | Commission assumptions validated via dashboard analytics first | Affiliate Marketing Expert |
| Full comparison tables (side-by-side editorial) | "Also consider" algorithm sufficient for MVP; editorial tables post-launch | Comparative Engine Expert |
| Reddit scraping for sentiment/compatibility | Legal review not complete; gated behind feature flag | Legal/Compliance Director |
| SaaS data source clients (PartnerStack, AppSumo, Impact) — full integration | Simulation mode acceptable for beta; real API integration post-launch if SaaS track validated | Full-Stack Engineer |
| `/alerts` dashboard with full preference management | MVP uses simple frequency/discount thresholds; full dashboard post-launch | UX Architect |
| Trigger.dev job monitoring + observability | Replaced by Vercel Cron + Supabase `pg_cron`; observability added post-launch | Platform/Infrastructure Architect |
| Physical-product UI (PriceHistoryChart, compatibility badges) | Deferred to Sprint 3 or post-MVP per CFO/CEO | Principal Product Designer |
| Watchlist feature | Deferred to post-MVP per Product/Business Strategist | Product/Business Strategist |
| Natural language search (`/ai-search`) | Post-launch SEO enhancement; keyword search sufficient for MVP | SEO/AEO Specialist |
| Hostinger → Vercel/Cloudflare Pages migration | Planned within 3–6 months; Hostinger is temporary MVP host | Platform/Infrastructure Architect |

---

## Sprint 1: Dual-Track Deal Pages + Search (Week 3-4, Starts After Beta Gate)

**Prerequisite:** Beta Go/No-Go checkpoint passed at end of Week 3. Beta metrics meet or exceed: CAC ≤ target, ≥10% store-to-alert conversion, ≥10% alert-to-store CTR.

**Validation:** `/deal/[slug]` renders for SaaS (promo/countdown) and physical (price chart placeholders). Search API works. Transparency banner visible.

> **Note for Sprint 1 designers:** The design-system primitive library has been deferred to post-launch. Components should be styled with Tailwind utility classes directly. Maintain a shared `components/ui/` directory for consistent class patterns even without a formal token system.

### 1.1 Deal Detail Page (Trust-First Design)
1. Update `apps/web/app/deal/[slug]/page.tsx`:
   - Fetch product by slug with new fields
   - **UX Designer**: Clear visual distinction between SaaS and physical tracks using Tailwind color classes (indigo for SaaS, emerald for physical) and iconography
   - **SaaS track**: promo code copy, countdown timer, deal type badge, trust metrics placeholder
   - **Physical track**: price placeholder with "Price history chart coming soon" message, compatibility badges placeholder
   - **Price freshness badge**: server-rendered, shows "Last verified" timestamp
   - **Transparency banner**: above the fold, "clear and conspicuous" per FTC
   - "Report incorrect price" form → `price_reports` table
2. Create components: `TransparencyBanner`, `DealCountdown`, `PromoCodeCopy`, `PriceFreshnessBadge`
3. **Accessibility**: ARIA labels, keyboard navigation, color contrast check (WCAG AA), `aria-live` announcements, skip links
4. **SEO/AEO**: Add `Product` schema (with `offers.price`, `offers.availability`), `FAQPage` and `HowTo` structured data, `dateModified` in schema
5. **Frontend UX**: On-demand revalidation triggered by `fetchPrices` webhook; no fixed 300s TTL
6. Update `sitemap.ts` and `robots.ts`

### 1.2 Search API
1. Create `apps/web/app/api/search/route.ts` with rate limiting, filters (`q`, `category`, `deal_type`, `min_discount`, `compatible_with`)
2. **Full-Stack**: Return minimal fields for performance
3. **Backend Expert**: Add `tsvector` column with GIN index on `products(name, description)` for full-text search
4. Add search bar to `Navbar.tsx`
5. Create `apps/web/app/search/page.tsx` with loading skeletons and empty states

### 1.3 SaaS Data Sources (Simulation Mode)
1. Create `packages/shared/src/api/partnerStackClient.ts` (simulation mode)
2. Create `packages/shared/src/api/appSumoClient.ts` (RSS parser, simulation mode)
3. Create `packages/shared/src/api/impactClient.ts` (simulation mode)
4. Export from `packages/shared/src/index.ts`
5. Wire into `fetchPrices.ts` — real API integration deferred to post-launch pending SaaS track validation

### 1.4 Homepage + Content Strategy
1. Update homepage hero: "AI tools, SaaS deals, smart home discounts"
2. Add "Deal of the Day" section
3. Update `FALLBACK_DEALS` to include SaaS
4. Create category pages: `/category/ai-writing`, `/category/project-management`, `/category/developer-tools`, `/category/lifetime-deals`, `/category/physical`, `/category/smart-home`
5. **Editorial**: Standardize deal description templates. Add "Best for" badges using deterministic rubric from `comparison_criteria` table.
6. **SEO/AEO**: Add 1-2 sentence TL;DR block at top of deal pages for AI search consumption

### 1.5 Subscribe Flow (Progressive Disclosure)
1. Replace `/subscribe` page with inline modal triggered from deal pages and homepage
2. **Principal Product Designer**: Contextual modal pre-selecting triggering deal's category
3. Progressive disclosure stepper: category → frequency → channel (email/push) → threshold
4. Support `?product=slug` deep-link parameters
5. **Accessibility**: Focus trapping, restoration on close, semantic form labels, `aria-live` for validation errors

### 1.6 Programmatic SEO Guardrails
1. **SEO/AEO Specialist**: Apply `noindex` to all auto-generated listing pages; only remove `noindex` once page receives organic traffic or earned backlink
2. Add editorial-content gating: a product page is only indexable when `editorial_summary` field is non-empty
3. Add `X-Robots-Tag` header on thin API responses
4. Prioritize topical authority over page count: 100 excellent pages on AI/smart home will outperform 10,000 auto-generated pages

### 1.7 Watchlist UI + Subscription Wiring (Deferred — Placeholder Only)
1. **Product/Business Strategist**: Add Watchlist button to `DealCard` and `DealDetailPage` as UI placeholder (non-functional)
2. Wire to `alert_queue` deferred to post-MVP
3. Retire `/subscribe` page as primary funnel; keep as backup

### 1.8 Intelligent Link Routing
1. **Affiliate Marketing Expert**: Implement `/api/route-link` endpoint with commission-based routing logic (already built in Sprint 0.8; verify integration here)
2. Route to retailer with highest effective commission (`current_price × commission_rate`), with tie-breaker to Amazon
3. Add `rel="sponsored"` enforcement to all affiliate `<a>` tags — CI gate enforces this
4. Log outbound clicks for conversion analytics; add geo-routing lookup for PartnerStack/Impact networks
5. Populate `retailer_links` table from `fetchPrices` with current prices and commission rates

---

## Sprint 2: Alert System + Trust Tools (Week 5-6)

**Validation:** Subscriber receives digest or targeted alert. True Cost calculator works. Trust metrics visible on deal pages.

> **Note:** Physical-product trust tools (PriceHistoryChart, compatibility badges) are deferred. Sprint 2 delivers SaaS trust tools only.

### 2.1 Alert System Refactor (Per-Subscriber Model)
1. Update `subscribers` table: add `notification_frequency`, `digest_time`, `min_discount_percent`, `min_absolute_savings`, `do_not_disturb_start`, `do_not_disturb_end`, `alert_preferences`
2. Rewrite `sendAlerts.ts` for per-subscriber rows:
   - Use `getSupabaseServiceClient()` for all queries and writes
   - Query `alert_queue` where `sent = false`, limit 50, join with `products` and `subscribers`
   - Each row already represents one (product, subscriber) pair — no in-memory subscriber filtering needed
   - Re-validate each alert against current subscriber preferences before dispatch
   - Check DND hours: queue for later if in DND window
   - Check Redis dedupe: `alert_sent:{subscriber_id}:{product_id}` (TTL 24h)
   - Send push + email, mark `sent = true`, increment `attempts`
   - On failure: increment `attempts` via RPC, if `>= 3` move to `dead_letter_queue`
3. Add `dead_letter_queue` table (already in 0.4 schema)
4. Add `job_runs` table + logging to both jobs (already in 0.4 schema)
5. Create `apps/jobs/src/jobs/expireDeals.ts` (hourly)
6. Create `apps/jobs/src/jobs/sendDailyDigest.ts` (daily at subscriber `digest_time`)
7. **Backend Expert**: Batch-fetch subscribers by IDs; add unique constraint on `alert_queue(subscriber_id, product_id, created_at)`

### 2.2 Alert Quality Score
1. Add `alert_quality_score` to `alert_queue` (0–100)
2. Score logic in `fetchPrices.ts`:
   - discount magnitude (0–40 pts)
   - source reliability (0–20 pts)
   - time since last alert to this subscriber (0–20 pts)
   - historical accuracy (0–20 pts)
3. In `sendAlerts.ts`: >70 → real-time push; 40–70 → digest; <40 → discard
4. **UX Architect**: Surface alert quality as "Why this alert?" explainer tooltip in `/alerts` dashboard (post-launch dashboard; placeholder in MVP)

### 2.3 SaaS Trust Tools
1. Update `products` table: add `true_cost_estimate`, `pricing_transparency_score`, `reddit_sentiment_summary` (text only, no numeric score in MVP), `program_stability_score`, `stability_notes`, `compatibility`, `setup_difficulty`, `app_count`, `reliability_notes`, `verified_working`
   - **Note**: Do NOT add `reddit_sentiment_score` numeric column in MVP; store summary text only
2. Create `apps/web/app/true-cost/page.tsx` (interactive calculator)
3. Create `packages/shared/src/utils/programStability.ts`
4. Update deal page to show trust badges with visual indicators
5. **Sentiment Analyst Designer**: Store summary text only; keyword-scoring pipeline and 3-state indicator deferred to post-launch

### 2.4 Smart Home Compatibility (Placeholder)
1. Create compatibility filter API: `GET /api/products?compatible_with=alexa,google_home,homekit`
2. Show compatibility badges on deal pages as text labels (icon rendering deferred to post-launch design system)
3. `compatibilityScraper.ts` scaffolding created but Reddit scraping execution blocked by legal review gate

### 2.5 Content + Comparison
1. **Comparative Engine**: Define "Best for" criteria explicitly in code rubric (price, features, ease of use, support quality, integrations) with fixed weights per category
2. Add "Also consider" section on deal pages: algorithmic selection (same category, ≤20% price difference, ≥3 shared core features), hard-cap at 3 products
3. `comparison_audit` table and `comparison_disputes` table already exist from Sprint 0 schema
4. **Editorial**: Create buying guide templates (`/guide/best-ai-writing-tools`)
5. **Sentiment Analyst**: Display 3-state sentiment placeholder ("Sentiment data coming soon") — full keyword-scoring pipeline deferred to post-launch

### 2.6 Affiliate Infrastructure
1. `/api/route-link` endpoint already built in Sprint 0.8; verify end-to-end in Sprint 2
2. **Affiliate Expert**: Generate unique click identifiers per outbound redirect with TTL matching longest attribution window (90 days); tie to `subscriber_id`
3. Add geo-routing fallback for PartnerStack/Impact networks
4. Inline disclosure text adjacent to every affiliate CTA
5. Add `rel="sponsored"` to all affiliate `<a>` tags — CI gate enforces this
6. S2S postback ingestion deferred to post-MVP; commission reconciliation via dashboard analytics only in MVP

### 2.7 Alerts Dashboard (Placeholder)
1. Create `/alerts` page where subscribers manage preferences
2. Collapsible sections: frequency, DND time-picker, discount thresholds
3. Show queued alerts list with basic info; quality explainer tooltip deferred to post-launch
4. **UX Architect**: MVP dashboard is functional but minimal; full preference management and alert quality explainer post-launch

### 2.8 Realistic Revenue Targets
1. **Business Viability Analyst**: Add revenue dashboard tracking actual commission rates by network and product category
2. Set expectation: SaaS (20–60% commission) is revenue foundation; physical (1–4%) is traffic/engagement
3. Model 12–18 month ramp to meaningful revenue; do not project meaningful physical revenue in year one
4. Track store-to-alert conversion (>15% target) and alert-to-store CTR (>10% target)
5. Monthly reconciliation: `/api/route-link` click logs vs. network conversion reports; commission assumptions invalidated if gap >20%

---

## Sprint 3: Observability + CI Compliance + Beta Hardening (Week 5-6, Parallel Track)

**Validation:** All CI compliance gates pass. Security headers present. Natural language search deferred to post-launch. Legal pages live. Beta metrics reviewed.

> **Note:** Visual QA pipeline, sentiment infrastructure, and natural language search are deferred to post-launch. Sprint 3 focuses on CI compliance hardening and production readiness within the 6-week total timeline.

### 3.1 E2E Tests
1. Expand `scripts/simulate-pipeline.ts` (seed 30 SaaS + 20 physical, mock APIs)
2. Add integration tests for `/api/subscribe`, `/api/search`, `/deal/[slug]`
3. **Accessibility**: Automated axe checks in CI; keyboard-only E2E smoke tests

### 3.2 Security Hardening
1. Add CSP headers to `next.config.js`
2. Validate `affiliate_links` JSONB schema in API routes
3. Verify rate limiting on `/api/search` and `/api/subscribe`
4. Verify `rel="sponsored"` enforcement via CI gate
5. **Backend Expert**: Add `Idempotency-Key` header support to `/api/subscribe`
6. **Legal/Compliance**: Verify cookie-consent banner blocks all non-essential scripts for EU/UK geo-IP sessions before any consent is given

### 3.3 Compliance CI Gates (Mandatory Before Deploy)
1. **Legal/Compliance Director**: Encode all compliance checks as CI gates:
   - `rel="sponsored"` scan: fail build if any affiliate `<a>` tag lacks the attribute
   - FTC disclosure placement check: fail build if disclosure block is not in the first 200px of deal page templates
   - Privacy-policy link check: fail build if footer does not contain `/privacy-policy` link
   - Brevo unsubscribe header check: fail build if `List-Unsubscribe` header is missing from email template
   - Cookie-consent gate check: fail build if EU/UK session test shows tracker scripts firing before consent
2. All gates must pass before PR merge to `main`

### 3.4 Performance
1. Benchmark Upstash Redis latency
2. Add cursor-based pagination for product lists
3. **Full-Stack**: Add loading skeletons and modular error boundaries per section (banner, pricing, trust)
4. **Frontend UX**: On-demand revalidation triggered by `fetchPrices` webhook; no fixed TTL
5. **Platform**: Define and enforce Core Web Vitals budgets in CI: LCP < 2.5s on 4G, INP < 200ms, CLS < 0.1

### 3.5 Trust Policy + Legal Pages
1. `docs/TRUST_POLICY.md`: no pay-for-play, no cookie override, one-click cancellation, no dark patterns
2. `/privacy-policy` page — must be live before Sprint 0 starts per Legal Director mandate
3. `/terms-of-service` page — must be live before Sprint 0 starts per Legal Director mandate
4. Add trust badges to footer
5. **Legal**: Affiliate disclosure above the fold on deal pages and homepage. OneSignal consent flow. Unsubscribe link in all Brevo emails.

### 3.6 Monitoring
1. **Architecture**: Add Cloudflare Uptime Monitoring (5min ping on `/api/health`)
2. **Architecture**: Add Sentry error tracking
3. **Architecture**: Add job monitoring alerts: `alert_queue` > 500 unsent, `fetchPrices` fails 2 consecutive runs, `dead_letter_queue` > 10 items
4. **Platform**: Add `/api/health` endpoint checking DB + Redis connectivity (already in Sprint 0 validation gate)
5. **Backend**: Schedule `retryDeadLetters` job with exponential backoff (1h, 6h, 24h)

### 3.7 Hostinger Migration Trigger Monitoring
1. **Platform/Infrastructure Architect**: Add alerting for CPU throttle events, memory usage >80%, response time p95 >2s
2. Define migration checklist and dry-run procedure for Vercel/Cloudflare Pages frontend migration
3. Set Cloudflare cache rules: static assets 1 day, HTML 5 min, API 1 min
4. Plan frontend migration within 3–6 months; Hostinger is temporary MVP host only

### 3.8 Beta Gate Review + Go/No-Go Checkpoint 1
1. Compile beta metrics: CAC, store-to-alert conversion, alert-to-store CTR, MRR if any paid tiers activated
2. Present to board against checkpoint 1 criteria
3. If Go: proceed to post-launch Sprint 4 roadmap (design system, sentiment pipeline, S2S postbacks, visual QA, full comparison tables)
4. If No-Go: pivot decision based on which metrics failed; 2-week reassessment window before resource reallocation

---

## Pre-Flight (Blocking Prerequisites — Must Complete Before Sprint 0 Starts)

### Legal & Business Prerequisites (New — Mandated by Legal Director, CEO, CFO)
- [ ] **Privacy policy drafted, reviewed by legal counsel, and published at `/privacy-policy`**
- [ ] **Terms of service drafted, reviewed by legal counsel, and published at `/terms-of-service`**
- [ ] **Cookie-consent banner implemented and tested**: geo-IP detection routes EU/UK visitors to consent flow; no tracker scripts fire before consent; consent state stored in cookie
- [ ] **Data-retention schedule defined and approved**: document retention periods per data class (alert_queue: 90 days, price_reports: 90 days, dead_letter_queue: 30 days, job_runs: 90 days, subscriber profiles: until deletion request)
- [ ] **Reddit scraping legal review complete**: confirm permissible use under Reddit API Terms; GDPR/CCPA obligations met; DPA with any third-party sentiment provider signed
- [ ] **DPA review initiated** for Brevo (EU data processing), OneSignal (EU data processing), Redis (if Redis Cloud with EU data)
- [ ] **2-page business-case addendum drafted** and board-approved: competitive positioning, unit economics, capital requirements, 4 Go/No-Go checkpoints
- [ ] **12-month P&L with 3 scenarios** (conservative/base/aggressive) finalized and shared with engineering leads

### Technical Prerequisites (Existing)
- [ ] Sign up for PartnerStack → API key (simulation mode acceptable for beta)
- [ ] Sign up for AppSumo → RSS feed URL (simulation mode acceptable for beta)
- [ ] Sign up for Impact.com → API key (simulation mode acceptable for beta)
- [ ] Sign up for Brevo → API key + sender email/name
- [ ] Sign up for OneSignal → app ID + REST API key (web push only)
- [ ] Sign up for Telegram → bot token (backup notification channel)
- [ ] Sign up for Discord → webhook URL (backup notification channel)
- [ ] Sign up for Canopy/Rainforest/ScrapingBee → API key (Amazon scraping fallback; optional for beta if eBay data is sufficient)
- [ ] Create Supabase project → run `packages/database/schema.sql`
- [ ] Update `.env.local` and `apps/jobs/.env` with real keys
- [ ] Manually insert 50 products into Supabase using Amazon Associates SiteStripe or eBay Browse API
- [ ] Set up Cloudflare account and configure cache rules (static 1 day, HTML 5 min, API 1 min)
- [ ] Set up UptimeRobot or equivalent for `/api/health` monitoring
- [ ] Set up Vercel project with Cron Jobs or Supabase project with `pg_cron` enabled

---

## Scale-Out Triggers (Post-MVP)

Migrate when any threshold is hit:
- >500 subscribers
- Hostinger CPU throttling >2x/week
- Monthly Hostinger cost >$20
- Alert queue row count exceeds 1M without archiving strategy
- MRR reaches $500 (unlocks paid notification/infra budget per CFO guardrail)
- PA-API eligibility earned (Amazon Browse API can be promoted to primary source)

**Migration path:** Vercel/Cloudflare Pages for frontend, edge functions for APIs, keep Supabase. Add PgBouncer connection pooler before scaling. Services stay within free tiers until MRR gate is cleared.
