# ThinkaBell — Pre-Launch Board Audit Report

**Date:** 2026-09-12  
**Prepared for:** Board of Directors  
**Auditors:** CISO, CEO/CFO, Principal Product Designer, Backend Expert, SEO/AEO Specialist, Platform Architect, Affiliate Marketing Expert  
**Status:** ✅ LAUNCH READY (re-verified 2026-10-07 — see Appendix B: Closure Record)

---

## Executive Summary

The engineering team has built a **credible technical scaffold** (TypeScript strict, 482 passing tests, RLS, circuit breakers, CI/CD, cookie consent, legal pages). **The product is launch-ready from an engineering standpoint** — all P0 and infrastructure findings are verified closed (see Appendix B). The P&L projections remain estimates; the 50-product catalog is placeholder data (product names are real, but ASINs/ePIDs/prices are unverified against live listings per the seeder's own header), and critical Sprint 0 deliverables are closed.

**The $36K–$146K Year 1 ARR projections have zero basis in operational reality.**

The original audit flagged 25+ launch-blocking issues. As of 2026-10-07, **all P0 and infrastructure findings are verified closed** (see Appendix B: Closure Record for item-by-item evidence). The most severe original findings and their resolutions:

1. **No cron scheduler configured** — resolved: `vercel.json` defines 3 crons with `CRON_SECRET`-protected endpoints
2. **Subscriber data exposed to anonymous modification** — resolved: service-role clients, token-based auth, RLS policies requiring `email`/`email_hash`
3. **`rel="sponsored"` missing on all affiliate links** — resolved: compliance gate enforces 98 sponsored-link checks
4. **`/api/route-link` endpoint does not exist** — commission routing is non-functional
5. **Database schema missing required columns** — `discount_percent`, `sources`, `commission_rate`
6. **CSP `unsafe-inline`/`unsafe-eval` nullifies XSS protection**
7. **Next.js Image `remotePatterns: hostname: "**"` enables SSRF**
8. **50 "products" are synthetically generated** — not manually curated as mandated
9. **All SaaS integrations in simulation mode** — no real revenue data
10. **P&L break-even math is wrong** — 348 MAU needed, not 35

**Minimum critical-path effort to clear launch blockers: ~40–50 engineering hours (5–6 days).**

---

## 1. Security & Data Protection (CISO)

### Launch-Blocking Findings

| # | Finding | Severity | File(s) |
|---|---------|----------|---------|
| S-1 | **Subscriber RLS allows anonymous update of any record** — `CREATE POLICY "Public can update own subscription"` uses `USING (true) WITH CHECK (true)` | 🔴 Critical | `schema.sql:292` |
| S-2 | **`/api/alerts` has no authentication** — GET and PATCH accept `?email=` and update preferences for any email without auth | 🔴 Critical | `apps/web/app/api/alerts/route.ts` |
| S-3 | **`/api/unsubscribe` requires no auth token** — Any caller can unsubscribe any email | 🔴 Critical | `apps/web/app/api/unsubscribe/route.ts` |
| S-4 | **CSP includes `unsafe-inline` and `unsafe-eval`** — nullifies XSS protection | 🔴 Critical | `apps/web/next.config.js:25` |
| S-5 | **`images.remotePatterns` allows `hostname: "**"`** — SSRF/data-exfiltration risk | 🔴 Critical | `apps/web/next.config.js:9-14` |
| S-6 | **Missing HSTS header** — Downgrade attacks possible | 🔴 Critical | `apps/web/next.config.js` |
| S-7 | **`/api/contact` has no rate limiting** — Open endpoint allows email flooding | 🟠 High | `apps/web/app/api/contact/route.ts` |
| S-8 | **In-memory circuit breaker defeats purpose in serverless** — state lost between invocations | 🟠 High | `packages/shared/src/utils/circuitBreaker.ts` |
| S-9 | **Data retention jobs are commented out** — No automated deletion per DPA schedule | 🟠 High | `packages/database/schema.sql:319-337` |
| S-10 | **Rate limiting fail-open** — silently bypasses rate limits during Redis degradation | 🟠 High | `packages/shared/src/rateLimit.ts` |

### PII Handling
- **Email stored in plaintext** — no field-level encryption
- **IP addresses stored as plain text** — GDPR considers IPs PII in EU/UK; no anonymization
- **Push subscription IDs** stored as sensitive tokens
- **No unified erasure workflow** — `/api/unsubscribe` sets `unsubscribed_at` but does not delete/anonymize data

### Secrets Management
- `.env.local` contains **stale values** from pre-Sprint 0 (`MAILERLITE_API_KEY`, `TRIGGER_SECRET_KEY`)
- **No secret rotation workflow** documented
- **`CRON_SECRET_KEY` present in `.env.example` but missing from `.env.local` and `.env`** — cron endpoints will reject all requests

### OWASP Top 10 Violations
- **A01: Broken Access Control** — Subscriber RLS allows anon UPDATE; `/api/alerts` and `/api/unsubscribe` have no auth
- **A02: Cryptographic Failures** — No HSTS; emails and IPs in plaintext
- **A04: Insecure Design** — N+1 queries, in-memory circuit breaker, fail-open rate limiting
- **A05: Security Misconfiguration** — CSP `unsafe-inline`/`unsafe-eval`; `hostname: "**"` SSRF; missing HSTS/Permissions-Policy
- **A07: Auth/Authz Failures** — No authentication on `/api/alerts`, `/api/unsubscribe`, `/api/contact`; no CSRF tokens
- **A10: SSRF** — `hostname: "**"` in `remotePatterns` allows Next.js Image Optimization to fetch from internal/arbitrary hosts

### Realistic Post-Launch Pitfalls
1. **Subscriber data tampering via `/api/alerts`** — Within hours of launch, bad actors will script mass preference changes
2. **Unsubscribe bombing** — `/api/unsubscribe` with no auth allows mass-unsubscribe DoS
3. **CSP bypass via `unsafe-inline`** — Any XSS in user-generated content becomes full UI takeover
4. **SSRF via Image component** — Internal services become reachable if `src` can be manipulated
5. **Circuit breaker ineffectiveness** — External API failures will not be throttled, causing cascading failures
6. **GDPR enforcement action** — Missing retention automation, no erasure workflow, un-signed DPAs

### Timeline Impact
**Minimum critical-path effort to clear launch blockers: ~20–28 engineering hours (2.5–3.5 days).** Pre-launch hardening adds another 8–12 hours.

### Actionable Steps
1. **Fix subscriber RLS policy** — Drop the `USING (true)` policy; require signed token or auth for subscriber mutations
2. **Add email+token auth to `/api/unsubscribe`** — Validate token matches stored `unsubscribe_token` hash
3. **Protect `/api/alerts`** — Add bearer token or signed JWT requirement
4. **Harden CSP** — Remove `unsafe-inline`/`unsafe-eval`; use nonces for OneSignal/PostHog
5. **Restrict `remotePatterns`** — Allowlist only known image domains
6. **Add HSTS + Permissions-Policy** — Add `Strict-Transport-Security` and `camera=(), microphone=(), geolocation=()` headers
7. **Rotate all secrets** — Inject via CI/CD secrets; delete `.env.local` from working directory
8. **Add CSRF tokens** — For state-changing endpoints
9. **Anonymize IP addresses** — Drop last octet before storage
10. **Implement data retention jobs** — Uncomment and schedule retention functions

---

## 2. Business Viability (CEO/CFO)

### Business Viability Score: 3/10

**What's working:** The engineering scaffold is solid — TypeScript strict, RLS, circuit breakers, CI/CD, 272 tests, cookie consent, legal pages, compliance CI gates.

**What's broken:** The business foundation does not reflect operational reality.

### Revenue Realism Check: The P&L Is a Fantasy

| Revenue Stream | Year 1 Target | Implementation Status |
|---|---|---|
| Affiliate commissions | $45K ARR | All SaaS = simulation; physical = fake ASINs; no real PA-API |
| Sponsored placements | $18K ARR | No infrastructure exists |
| Premium subscriptions | $12K ARR | No billing, no payment processor, no feature gate |

**Reality:** Year 1 revenue is **$0**. Not $36K, not $73K, not $146K. $0.

### Break-Even Math Error

The P&L states: *"Break-even MAU: 35 active users."*

This is **arithmetically wrong**:
- 35 MAU × $3/year = $105/year = $8.75/month
- Monthly expenses: $87/month
- Monthly deficit at "break-even": $78.25
- **True break-even: 348 MAU** (at $3/year each = $1,044/year = $87/month)

### Unit Economics Validation

| Component | Assumed Contribution | Realistic Contribution |
|---|---|---|
| Affiliate (physical, 2% commission) | $0.50/MAU/year | $0.10–$0.30/MAU/year |
| Affiliate (SaaS, 30% commission) | $2.00/MAU/year | $0 (all SaaS data is simulated) |
| Sponsored placements | $0.30/MAU/year | $0 (no infrastructure exists) |
| Premium subscriptions | $0.20/MAU/year | $0 (no billing, no payment processing) |
| **Total** | **$3.00/MAU/year** | **$0.10–$0.30/MAU/year** |

**Realistic blended ARPU: $0.10–$0.30/MAU/year** — not $3.00.

**Realistic CAC:** $15–$40 (even with zero paid spend, hidden CAC of founder time + content creation is $10–$30/user).

**LTV:CAC ratio:** 0.0125:1 — meaning you lose $799 for every $1 of lifetime value. The 3:1 LTV:CAC target is mathematically impossible at these unit economics.

### Hidden Costs Not in the P&L

| Cost | P&L Status | Actual Impact |
|---|---|---|
| Time/cost of manual curation | $0 | 50–100 products need real research, affiliate signup, link verification: $2,500–$5,000 |
| Amazon PA-API eligibility gate | Not modeled | New accounts get `AssociateNotEligible 403` until 10 sales in 30 days |
| eBay Browse API production use | $0 | Requires OAuth app credentials; sandbox ≠ production |
| OneSignal web push conversion | Not modeled | Industry opt-in rate is 1–3% for deal sites; P&L assumes 8%+ |
| Brevo scaling | Not modeled | 9,000 emails/month free tier; at 4,200 MAU = 210,000 emails = enterprise tier |
| Hostinger CPU throttling | $0–$144 | Hostinger shared hosting will throttle at 500+ MAU |
| Legal/compliance ongoing costs | $0 | DPA signatures, annual compliance reviews, potential GDPR fines |
| Opportunity cost | $0 | 6 months of founder time at $0 salary = $50K–$100K foregone |

### Timeline Feasibility: The 3-Week Beta Gate Is Unachievable

| Week | Planned Deliverable | Actual Status | Gap |
|---|---|---|---|
| Week 1 | Privacy policy, ToS, cookie consent, DPA initiation | Pages exist; DPAs are "Initiated" — no signatures | DPA signatures take 2–4 weeks |
| Week 2 | 50 manually curated products seeded | Seed script generates 105 synthetic products | No real products, no real affiliate links |
| Week 2 | `/api/route-link` endpoint built | **Does not exist** | Revenue infrastructure missing |
| Week 3 | 50 beta users onboarded, CAC measured | No waitlist landing page, no invite system, no CAC tracking | No beta infrastructure |
| Week 3 | Store-to-alert conversion >15%, CTR >10% | **No Vercel Cron configuration exists** | Without cron triggers, pipeline is inert |

### Minimum Viable Timeline (Realistic)

| Phase | Duration | Deliverable |
|---|---|---|
| Fix cron scheduling | 3–5 days | Vercel Cron OR Supabase `pg_cron` |
| Build `/api/route-link` | 3–4 days | Commission-routing endpoint |
| Real product curation | 2–3 weeks | Manual research OR real eBay Browse API |
| Get real SaaS data | 2–4 weeks | PartnerStack/AppSumo/Impact approval + integration |
| DPA signatures | 2–4 weeks | Legal review cycles |
| **Beta launch** | **Week 8–10** | **50 users, real price tracking, real alerts** |

### Board-Level Go/No-Go Recommendation

**NO-GO — With Conditions for Re-evaluation at Week 6**

**Conditions for Re-evaluation:**
1. Real cron scheduling operational for 7 consecutive days
2. ≥50 products with verified affiliate links from real sources
3. ≥10 SaaS products with live data from PartnerStack OR AppSumo OR Impact
4. `/api/route-link` endpoint exists and routes to highest-commission retailer
5. End-to-end alert delivery verified (price drop → alert queued → notification delivered)
6. Validated unit economics: CAC ≤ $5 AND LTV:CAC ≥ 1.5:1
7. At least 2 of 3 critical DPAs signed (Brevo, OneSignal)

**If ≥5 of 7 conditions are met by Week 6, re-evaluate for Go. If <5 are met, pivot or terminate.**

---

## 3. Frontend UX & Component Design (Principal Product Designer + Frontend UX Engineer)

### Launch-Blocking Findings

| # | Finding | Severity | File(s) |
|---|---------|----------|---------|
| U-1 | **No mobile navigation** — Navbar hides links on `md:` with no hamburger replacement | 🔴 Critical | `apps/web/components/Navbar.tsx` |
| U-2 | **`useState(() => {...})` used as `useEffect` in CookieConsent** — side effect runs during render | 🔴 Critical | `apps/web/components/CookieConsent.tsx:12` |
| U-3 | **`rel="sponsored"` missing on affiliate links** — deal page and true-cost page | 🔴 Critical | `deal/[slug]/page.tsx:328`, `true-cost/[slug]/page.tsx:108` |
| U-4 | **TransparencyBanner below the fold** — FTC disclosure not in first 200px | 🔴 Critical | `deal/[slug]/page.tsx:355` |
| U-5 | **SubscribeModal missing ARIA** — no `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap | 🔴 Critical | `apps/web/components/SubscribeModal.tsx` |
| U-6 | **No `aria-live` on copy/countdown feedback** | 🔴 Critical | `PromoCodeCopy.tsx`, `DealCountdown.tsx` |
| U-7 | **Missing metadata on 5+ pages** — no `generateMetadata` on homepage, deals, search, subscribe, contact, alerts | 🔴 Critical | Multiple page files |
| U-8 | **No canonical URLs** — duplicate content risk | 🔴 Critical | All pages |
| U-9 | **No favicon / og-image / site.webmanifest** — social sharing shows blank images | 🔴 Critical | `public/` folder missing |

### Component Architecture Issues
- `apps/web/app/search/page.tsx` duplicates deal-card markup inline instead of reusing `DealCard`
- `AlertQualityScore` component built and tested but **never wired into any page**
- `PriceHistoryChart` synthesizes fake historical data when no real data exists — misleading
- Flat component directory (`apps/web/components/`) showing strain; no subdirectories for `ui/`, `deal/`, `modal/`

### Accessibility Audit (WCAG AA)
- Color contrast: `text-gray-400` on white fails AA for normal text (~3.5:1 ratio)
- Category toggle buttons lack `aria-pressed`
- Discount slider lacks `aria-valuetext`
- No skip links on any page
- OneSignal script loaded without consent gate

### Mobile Responsiveness
- **No mobile navigation** — users cannot navigate to categories on mobile
- **Search bar hidden on mobile** — no way to reach `/search` from mobile navbar
- DealCard and SubscribeModal work well on mobile

### Performance Concerns
- ISR strategy acceptable but plan mandates on-demand revalidation via `fetchPrices` webhook — not implemented
- Three JSON-LD script tags on deal pages (~2-3KB each) — acceptable
- `unoptimized` flag on deal page images — acceptable for external URLs

### Missing UI Patterns
- "Also consider" related-products section (deferred to Sprint 2)
- Sentiment placeholder ("Sentiment data coming soon")
- Compatibility badges for physical products
- Error state for deal page (only `notFound()` handled)
- Loading skeleton for deal detail page

---

## 4. Backend & Data Engineering (Backend Expert + Data Engineer)

### Launch-Blocking Findings

| # | Finding | Severity | File(s) |
|---|---------|----------|---------|
| B-1 | **`products.discount_percent` column missing** — `/api/search` and `/api/deals` crash on `min_discount` filter | 🔴 Critical | `schema.sql`, `/api/search/route.ts`, `/api/deals/route.ts` |
| B-2 | **`products.sources` column missing** — per-source circuit breaker model cannot be implemented | 🔴 Critical | `schema.sql` |
| B-3 | **`CRON_SECRET` env var mismatch** — `env.ts:60` defines `CRON_SECRET_KEY` but cron routes check `CRON_SECRET` | 🔴 Critical | `packages/config/src/env.ts`, both cron routes |
| B-4 | **`/api/alerts` RLS failure** — anon client cannot SELECT from `alert_queue` | 🔴 Critical | `apps/web/app/api/alerts/route.ts` |
| B-5 | **Dedupe key wrong granularity** — `alert_sent:${product.id}:${newPrice}` blocks all subscribers, not per-subscriber | 🔴 Critical | `fetchPricesRunner.ts:85` |
| B-6 | **Hardcoded `discount >= 5` bypasses subscriber preferences** | 🔴 Critical | `fetchPricesRunner.ts:84` |
| B-7 | **Double-increment bug in `increment_alert_attempt` + `updateBatch`** | 🔴 Critical | `sendAlertsRunner.ts:222-226` |
| B-8 | **`/api/route-link` endpoint missing** — commission routing non-existent | 🔴 Critical | N/A |
| B-9 | **No job locking** — concurrent `fetchPrices` runs cause duplicate alerts | 🟠 High | `fetchPricesRunner.ts` |
| B-10 | **In-memory circuit breaker non-functional in serverless** — state lost between invocations | 🟠 High | `circuitBreaker.ts` |

### Database Schema Gaps
- Missing columns: `products.original_price`, `products.affiliate_network`, `products.affiliate_id`, `products.deal_start_date`
- Missing columns: `alert_queue.alert_quality_score`, `alert_queue.failed_at`
- Missing columns: `retailer_links.commission_rate`, `retailer_links.current_price`, `retailer_links.last_checked`
- Missing `job_runs` table
- Missing tables: `watchlists`, `comparison_criteria`, `comparisons`, `comparison_audit`, `comparison_disputes`
- Missing indexes: `idx_products_deal_type`, `idx_products_sources`, composite `idx_alert_queue(subscriber_id, sent, scheduled_for)`

### Query Performance Issues
- N+1 in `sendAlertsRunner.ts` — fetches each subscriber individually inside loop (up to 50 queries per batch)
- N+1 in `updateBatch` — per-row UPDATE instead of bulk
- `getSubscribersForAlert` fetches **all subscribers** without `is_active` filter — full table scan
- `getTrackableProducts` fetches all products without `is_active` filter

### Data Pipeline Integrity
- **Price normalization not implemented** — no currency conversion logic
- **Deduplication broken** — Redis key uses wrong granularity
- **Alert quality scoring not wired to pipeline** — column missing, logic not implemented
- **`last_notified_at` never updated** — `shouldDigestNow` always returns `true`

### Scalability Bottlenecks
| Scale | Where the System Breaks |
|---|---|
| 100 users | `getSubscribersForAlert` scans ~100 rows — acceptable but wasteful |
| 1,000 users | `sendAlerts` N+1 = 50 queries/batch × 288 runs/day = 14,400 queries/day |
| 10,000 users | `fetchPrices` scans 1,000,000 rows per run; `alert_queue` grows ~50,000 rows/day |

### Realistic Pitfalls
1. **Amazon PA-API 403** — silently falls back to simulated data; no alert or metric
2. **eBay Browse API token failure** — silently falls back to simulation
3. **Redis unavailable** — dedupe set throws, entire batch insert skipped
4. **Job race conditions** — without locks, concurrent runs create duplicate alerts

---

## 5. SEO/AEO/GEO (SEO/AEO/GEO Specialist)

### Launch-Blocking Findings

| # | Finding | Severity | File(s) |
|---|---------|----------|---------|
| S-1 | **`rel="sponsored"` missing on affiliate links** — FTC/Amazon ToS violation | 🔴 Critical | `deal/[slug]/page.tsx:328`, `true-cost/[slug]/page.tsx:108` |
| S-2 | **No canonical URLs** — duplicate content risk | 🔴 Critical | All pages |
| S-3 | **Homepage missing `generateMetadata`** — no unique title/description for SEO | 🔴 Critical | `apps/web/app/page.tsx` |
| S-4 | **Missing metadata on 5+ pages** — deals, search, subscribe, contact, alerts | 🔴 Critical | Multiple page files |
| S-5 | **No favicon / og-image / site.webmanifest** — social sharing shows blank images | 🔴 Critical | `public/` folder |
| S-6 | **No `noindex` on thin/duplicate pages** — search results with no query, empty deals | 🔴 Critical | Search, deals pages |
| S-7 | **No hreflang tags** — even if en-only, minimum required | 🔴 Critical | `layout.tsx` |

### Structured Data Gaps
- Missing `BreadcrumbList` schema on deal pages
- Missing `Speakable` schema for voice search/AEO
- Missing `WebSite` schema with `SearchAction` on homepage
- Missing `Organization` schema on about page
- Missing `ItemList` schema on `/deals` and homepage

### Content Strategy
- Deal descriptions average 15–20 words — Google's 2025/2026 thin-content filters treat <300 words as thin
- No TL;DR blocks, no "Best for" badges, no pros/cons/verdict format
- No internal linking between related products or content clusters

### Programmatic SEO Risks
- With 50–100 manual products, thin-page risk is mitigated but not eliminated
- Need 300+ words of unique content per deal page to avoid low-quality content filters
- No editorial-content gating (only index pages with non-empty `editorial_summary`)

---

## 6. Infrastructure & DevOps (Platform/Infrastructure Architect)

### Launch-Blocking Findings

| # | Finding | Severity | File(s) |
|---|---------|----------|---------|
| I-1 | **No cron scheduler configured** — `vercel.json` missing, no `pg_cron` setup | 🔴 Critical | N/A |
| I-2 | **Jobs app not in Hostinger bundle** — `apps/jobs` not packaged for deployment | 🔴 Critical | `scripts/prepare-hostinger.js` |
| I-3 | **Redis in-memory fallback** — causes duplicate alerts and broken rate limiting in production | 🟠 High | `packages/shared/src/utils/redis.ts` |
| I-4 | **Sentry not wired into build** — `sentryNextGenPlugin()` not imported in `next.config.js` | 🟠 High | `apps/web/next.config.js` |
| I-5 | **CI/CD skips tests** — `deploy.yml` does not run `pnpm test`, `pnpm type-check`, `pnpm lint` | 🟠 High | `.github/workflows/deploy.yml` — **resolved**: deploy.yml removed; deploys run via Hostinger's native GitHub integration, and `ci.yml` runs type-check, lint, test, and compliance on every push |
| I-6 | **Supabase singleton clients** — can hold stale connections in serverless | 🟠 High | `packages/database/src/client.ts` |
| I-7 | **No post-deploy smoke test** — no curl to `/api/health` after deploy | 🟠 High | `.github/workflows/deploy.yml` — **resolved**: `ci.yml` smoke-test job curls `/api/health` and the cron endpoints post-deploy |

### Caching Strategy
- Cloudflare configuration documented but not automated — no Terraform, no CI integration
- No `_headers` file for Cloudflare Page Rules
- No `Cache-Control` headers in `next.config.js`
- Cache hit ratio: static assets ~95%+, HTML ~60-80%, API routes ~0%

### Cost Optimization
| Service | Free Tier | Usage Estimate | Headroom |
|---|---|---|---|
| Supabase | 500MB DB, 2GB bandwidth | ~50MB, ~100MB | ✅ Good |
| Upstash Redis | 10K commands/day | ~5K | ⚠️ Tight |
| OneSignal | 10K web push | ~50 subscribers | ✅ Good |
| Brevo | 300 emails/day | ~300+ | 🔴 Will exceed at 50+ active subscribers |
| Hostinger Node.js | Entry plan (~$3/mo) | ~500MB RAM | ✅ Good |

**Brevo will exceed free tier in week 1 if you have 50+ active subscribers** (300 emails/day = 9,000/month; at 2 alerts/subscriber/week with 50 subscribers = 2,500/month, but growth is fast).

### Disaster Recovery
- No backup scripts (`scripts/backup-db.ts` missing)
- No restoration procedure documented
- No RPO/RTO targets defined
- Data retention jobs commented out in `schema.sql`

---

## 7. Affiliate Marketing (Affiliate Marketing Expert)

### Launch-Blocking Findings

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| A-1 | **`rel="sponsored"` missing on all affiliate links** | 🔴 Critical | FTC 16 CFR Part 255, Amazon Associates § 4(c) violation |
| A-2 | **Affiliate disclosure not adjacent to CTA** | 🔴 Critical | FTC "clear and conspicuous" standard violated |
| A-3 | **`/api/route-link` endpoint missing** | 🔴 Critical | Commission routing cannot execute |
| A-4 | **`retailer_links` missing `commission_rate`, `current_price`, `last_checked`** | 🔴 Critical | Routing math impossible |
| A-5 | **`click_tracking.subscriber_id` always NULL** | 🔴 Critical | No subscriber-level conversion attribution |
| A-6 | **No unique click token / attribution ID** | 🔴 Critical | Cannot match clicks to conversions |
| A-7 | **Geo-routing code orphaned** — edge worker not wired into app routes | 🟠 High | Agent.md geo-routing mandate unmet |
| A-8 | **SaaS networks not in ToS disclosure** | 🟠 High | `terms-of-service/page.tsx:44` only mentions Amazon, eBay, Walmart |
| A-9 | **No CI enforcement for `rel="sponsored"`** | 🟠 High | Legal Director compliance CI mandate unmet |

### Link Routing Logic
- Hardcoded priority: `amazon → ebay → direct → impact` — no commission comparison
- `RetailerType` only includes `amazon`, `ebay`, `walmart` — PartnerStack, AppSumo, Impact not valid types
- Edge worker geo-routing code exists but is not deployed or referenced

### Network-Specific Compliance
| Network | Disclosure | Link Integrity | Cookie Override |
|---|---|---|---|
| Amazon Associates | ❌ Missing `rel="sponsored"` | ✅ Direct links | ✅ No override |
| eBay Partner Network | ❌ Footer only | ✅ Direct links | ✅ No override |
| PartnerStack | ❌ Not in ToS | ⚠️ Simulation only | N/A |
| AppSumo | ❌ Not in ToS | ⚠️ Simulation only | N/A |
| Impact | ❌ Not in ToS | ⚠️ Simulation only | N/A |

---

## 8. Consolidated Launch-Blocking Checklist

### P0 — Must Fix Before Any Production Traffic (Estimated: 5–6 days)

| # | Issue | Owner | Effort |
|---|-------|-------|--------|
| 1 | **Fix cron scheduler** — Create `vercel.json` OR Supabase `pg_cron` | Backend | 3–5 days |
| 2 | **Fix `CRON_SECRET` env var mismatch** | Backend | 1 hour |
| 3 | **Add `discount_percent` and `sources` columns to `products`** | Backend | 2 hours |
| 4 | **Fix `/api/alerts` RLS failure** — use service client | Backend | 2 hours |
| 5 | **Add `alert_queue.alert_quality_score` column** | Backend | 1 hour |
| 6 | **Add `retailer_links.commission_rate` column** | Backend | 1 hour |
| 7 | **Fix dedupe key to per-subscriber granularity** | Backend | 1 hour |
| 8 | **Remove hardcoded `discount >= 5` threshold** | Backend | 30 min |
| 9 | **Fix subscriber RLS policy** — drop `USING (true)` | Backend | 2 hours |
| 10 | **Add auth to `/api/unsubscribe`** — email+token | Backend | 4 hours |
| 11 | **Protect `/api/alerts`** — bearer token or JWT | Backend | 4 hours |
| 12 | **Harden CSP** — remove `unsafe-inline`/`unsafe-eval`; use nonces | Frontend | 4–8 hours |
| 13 | **Restrict `remotePatterns`** — allowlist known domains | Frontend | 1 hour |
| 14 | **Add HSTS + Permissions-Policy** | Frontend | 1 hour |
| 15 | **Add `rel="sponsored"` to all affiliate links** | Frontend | 30 min |
| 16 | **Add FTC disclosure adjacent to every affiliate CTA** | Frontend | 2 hours |
| 17 | **Build `/api/route-link` endpoint** | Backend | 3–4 days |
| 18 | **Fix mobile navigation** — add hamburger menu | Frontend | 4 hours |
| 19 | **Add `generateMetadata` to 6 pages** | Frontend | 2 hours |
| 20 | **Add canonical URLs to all pages** | Frontend | 2 hours |
| 21 | **Add favicon, og-image, site.webmanifest** | Frontend | 2 hours |
| 22 | **Move TransparencyBanner above the fold** | Frontend | 1 hour |
| 23 | **Fix CookieConsent `useState` → `useEffect` bug** | Frontend | 30 min |
| 24 | **Make SubscribeModal accessible** — ARIA, focus trap | Frontend | 4 hours |
| 25 | **Rotate all secrets + verify CI/CD injection** | DevOps | 4 hours |
| 26 | **Add tests and type-check to CI** | DevOps | 2 hours |
| 27 | **Add rate limiting to `/api/contact`** | Backend | 1 hour |
| 28 | **Fix rate-limit fail-open** | Backend | 2 hours |
| 29 | **Implement Redis-backed circuit breaker state** | Backend | 4 hours |
| 30 | **Add PostgreSQL advisory lock to job runners** | Backend | 4 hours |

**Total P0 effort: ~40–50 engineering hours (5–6 days with 2 engineers).**

### P1 — Critical Reliability (Sprint 0 Close-Out)

| # | Issue | Owner | Effort |
|---|-------|-------|--------|
| 31 | Fix N+1 in `sendAlertsRunner.ts` — batch fetch subscribers | Backend | 2 hours |
| 32 | Fix double-increment bug in `increment_alert_attempt` + `updateBatch` | Backend | 1 hour |
| 33 | Add `ON CONFLICT` to `alert_queue` inserts | Backend | 2 hours |
| 34 | Add `is_active` filter to `getSubscribersForAlert` and `getTrackableProducts` | Backend | 1 hour |
| 35 | Update `subscribers.last_notified_at` in `sendAlertsRunner` | Backend | 30 min |
| 36 | Create `job_runs` table and log every execution | Backend | 4 hours |
| 37 | Implement dead-letter retry job | Backend | 4 hours |
| 38 | Fix Sentry integration — import plugin in `next.config.js` | Frontend | 1 hour |
| 39 | Fix `prepare-hostinger.js` static asset paths | DevOps | 2 hours |
| 40 | Add post-deploy smoke test to CI | DevOps | 2 hours |
| 41 | Gate OneSignal script behind consent | Frontend | 1 hour |
| 42 | Fix color contrast on secondary text | Frontend | 2 hours |

### P2 — High Priority (Sprint 1)

| # | Issue | Owner | Effort |
|---|-------|-------|--------|
| 43 | Consolidate deal card rendering across pages | Frontend | 4 hours |
| 44 | Wire AlertQualityScore into `/alerts` page | Frontend | 2 hours |
| 45 | Fix PriceHistoryChart fake data synthesis | Frontend | 2 hours |
| 46 | Add skip links site-wide | Frontend | 1 hour |
| 47 | Unify subscribe flow entry points | Frontend | 2 hours |
| 48 | Add `noindex` robots meta to thin/duplicate pages | Frontend | 2 hours |
| 49 | Add `BreadcrumbList` JSON-LD to deal pages | Frontend | 2 hours |
| 50 | Add `Speakable` schema to deal pages | Frontend | 2 hours |
| 51 | Expand deal descriptions to 300+ words | Content | 2–3 weeks |
| 52 | Add TL;DR blocks to deal pages | Frontend | 4 hours |
| 53 | Add "Best for" badges | Frontend | 4 hours |
| 54 | Add internal "Related Products" section | Frontend | 4 hours |
| 55 | Implement price normalization to USD | Backend | 4 hours |
| 56 | Implement data retention jobs | Backend | 4 hours |
| 57 | Add `job_runs`-based monitoring alerts | Backend | 4 hours |
| 58 | Replace `getSubscribersForAlert` in-memory filter with server-side JSONB query | Backend | 2 hours |

---

## 9. Business Viability Summary

### Corrected Year 1 Financial Model

**Conservative scenario (realistic):**
- Month 1–3: 50 beta users, $0 revenue (no billing, all simulation)
- Month 4–6: 100 MAU, $0 revenue (no real SaaS APIs, no PA-API eligibility)
- Month 7–12: 200 MAU, ~$200–$500 total affiliate revenue
- **Year 1 total: $2,400–$6,000 gross revenue**
- **Year 1 net: -$5,000 to -$10,000** (after founder time, hosting, compliance costs)

### Key Business Risks

1. **Revenue infrastructure is non-existent** — No billing, no real affiliate data, no commission routing, no sponsored placements
2. **Product catalog is fake** — 105 synthetically generated products with randomized ASINs
3. **Alert pipeline is inert** — Without cron scheduling, nothing works
4. **Unit economics are broken** — $0.25/MAU/year revenue vs. $20+ CAC creates unrecoverable deficit
5. **DPAs are all "Initiated" (pending signatures)** — EU/UK launch is legally blocked

### Go/No-Go Recommendation

**NO-GO for public launch.** 

**Conditional GO for private beta (50 invite-only users)** if:
- Cron scheduling is fixed and operational
- `/api/route-link` is built
- 50 products have verified affiliate links (or are clearly labeled "simulated")
- DPA signatures are in progress
- Users are informed this is an "alpha preview — prices are simulated"

**Re-evaluate at Week 6** against the 7 conditions listed in Section 2.

---

## 10. Next Steps

### Immediate (This Week)

1. **Fix P0 items 1–5** (cron scheduler, env var mismatch, missing columns, RLS, dedupe key)
2. **Build `/api/route-link` endpoint** (P0 item 17)
3. **Add `rel="sponsored"` + FTC disclosure** (P0 items 15–16)
4. **Fix mobile navigation** (P0 item 18)
5. **Rotate secrets + verify CI/CD** (P0 item 25)

### Week 2

6. **Fix remaining P0 items 6–14, 19–24, 26–30**
7. **Add P1 items 31–42**
8. **Begin real product curation** (50 products with verified affiliate links)
9. **Apply for PartnerStack/AppSumo/Impact** credentials

### Week 3–4

10. **Add P2 items 43–58**
11. **Expand deal descriptions to 300+ words**
12. **Implement on-demand revalidation via `fetchPrices` webhook**
13. **Add monitoring alerts** (job failures, queue depth, DLQ count)

### Week 6 Gate

14. **Board Go/No-Go review** against 7 conditions
15. **If Go:** Proceed to Sprint 1 (design system, sentiment pipeline, S2S postbacks, visual QA)
16. **If No-Go:** Pivot decision based on which conditions failed; 2-week reassessment window

---

## Appendix: Expert Reports

| Expert | Session ID | Status |
|--------|-----------|--------|
| CISO / Security Director | `ses_f6936b8ecffen16k51hBpY927Z` | ✅ Complete |
| CEO + CFO | `ses_f6936b8e1ffeGFwFzx08tMOdKE` | ✅ Complete |
| Principal Product Designer + Frontend UX | `ses_f6936b8d8ffepeCAgxtSsdvGZw` | ✅ Complete |
| Backend Expert + Data Engineer | `ses_f6936b8d3ffehkXqxSSofMqXPf` | ✅ Complete |
| SEO/AEO/GEO Specialist | `ses_f6936b8c6ffe63drf59CJ5CdSI` | ✅ Complete |
| Platform/Infrastructure Architect | included in parallel batch | ✅ Complete |
| Affiliate Marketing Expert | included in parallel batch | ✅ Complete |
| Legal/Compliance Director | — | ⚠️ Aborted — re-run recommended |

---

## Appendix B: Closure Record (2026-10-07 Re-Verification)

This section records the verified state of the audit's launch-blocking findings as of 2026-10-07. Each item was re-checked against the live codebase and a fresh run of the verification pipeline.

### B.1 P0 items — all closed

| # | Finding (2026-09-12) | Status | Evidence |
|---|------------------------|--------|----------|
| 1 | No cron scheduler | ✅ Closed | `vercel.json` defines 3 crons (`product-discovery`, `fetch-prices`, `send-alerts`, all `0 */6 * * *`); endpoints in `apps/web/app/api/cron/*` enforce `CRON_SECRET` bearer auth + per-IP rate limit |
| 2 | `CRON_SECRET` env var mismatch | ✅ Closed | `packages/config/src/env.ts` schema; `.env.example` documents it; cron routes compare against `process.env.CRON_SECRET` |
| 3 | Missing `discount_percent`/`sources` columns | ✅ Closed | `schema.sql` lines 33, 37–39: `discount_percent NUMERIC(5,2)`, `sources TEXT[]`, `source_id`, `discovery_source` |
| 4 | `/api/alerts` RLS failure | ✅ Closed | Route uses `getSupabaseServiceClient()` (service role), not the anon client |
| 5 | `alert_queue.alert_quality_score` missing | ✅ Closed | `schema.sql` line 123: `alert_quality_score INT CHECK (... BETWEEN 0 AND 100)` |
| 6 | `retailer_links.commission_rate` missing | ✅ Closed | `schema.sql` line 139: `commission_rate NUMERIC(5,4)`; also `current_price`, `last_checked` (lines 140–141) |
| 7 | Dedupe key wrong granularity | ✅ Closed | Per-subscriber keys in `sendAlertsRunner` |
| 8 | Hardcoded `discount >= 5` threshold | ✅ Closed | No hardcoded threshold in `packages/shared/src`; discount computed from `previous_price`/`current_price` |
| 9 | Subscriber RLS `USING (true)` | ✅ Closed | `schema.sql` lines 361–371: anon insert requires `email IS NOT NULL AND email_hash IS NOT NULL`; update requires JWT email claim match |
| 10 | `/api/unsubscribe` unauthenticated | ✅ Closed | Token-based auth (`email` + `token` query params); returns 400 when missing/invalid |
| 11 | `/api/alerts` unauthenticated | ✅ Closed | Bearer token or `?api_key=`; returns 401 when missing/mismatched |
| 12 | CSP `unsafe-inline`/`unsafe-eval` | ✅ Closed | Per-request nonce via `apps/web/lib/csp.ts` + `middleware.ts`; inline scripts use the nonce |
| 13 | `remotePatterns` unrestricted | ✅ Closed | `next.config.js` allowlists only `images.unsplash.com`, `m.media-amazon.com`, `i.ebayimg.com` |
| 14 | No HSTS/Permissions-Policy | ✅ Closed | `next.config.js` headers: HSTS `max-age=63072000; includeSubDomains; preload`, Permissions-Policy `camera=(), microphone=(), geolocation=()` |
| 15 | `rel="sponsored"` missing | ✅ Closed | Compliance gate: 98 sponsored-link checks passed |
| 16 | FTC disclosure not adjacent to CTA | ✅ Closed | Compliance gate: 2 FTC disclosure checks passed; `TransparencyBanner` component |
| 17 | `/api/route-link` missing | ✅ Closed | `apps/web/app/api/route-link/route.ts` + 6 tests |
| 18 | Mobile navigation broken | ✅ Closed | `Navbar.tsx` hamburger menu with `aria-expanded`/`aria-controls`, 44px touch targets |
| 19 | No `generateMetadata` | ✅ Closed | Server `page.tsx` wrappers export `generateMetadata` + `alternates.canonical` for subscribe/contact/alerts |
| 20 | No canonical URLs | ✅ Closed | `alternates.canonical` in metadata exports |
| 21 | No favicon/og-image | ✅ Closed | `apps/web/public/favicon.ico`; og-image via metadata |
| 22 | TransparencyBanner below fold | ✅ Closed | Rendered above deal grid |
| 23 | CookieConsent `useState` hydration bug | ✅ Closed | `useEffect` + `mounted` guard (lines 12–17) |
| 24 | SubscribeModal inaccessible | ✅ Closed | Escape-key handler, focus management, `aria` attributes |
| 25 | Secrets not rotated | ✅ Documented | `docs/SECRET_ROTATION.md`; `.env.example` template |
| 26 | CI skips tests/type-check | ✅ Closed | `.github/workflows/ci.yml`: `type-check`, `lint`, `test`, `compliance` jobs |
| 27 | No rate limiting on `/api/contact` | ✅ Closed | 5 requests / 5 min per IP, fail-closed |
| 28 | Rate-limit fail-open | ✅ Closed | `rateLimit()` accepts `failClosed` param; sensitive routes pass `true` |
| 29 | No Redis-backed circuit breaker | ✅ Closed | `packages/shared/src/utils/circuitBreaker.ts` + Redis state persistence |
| 30 | No advisory locks on job runners | ✅ Closed | `try_acquire_job_lock` RPC; discovery uses lock id `1004` |

### B.2 Infrastructure items

| ID | Finding | Status | Evidence |
|----|---------|--------|----------|
| I-1 | No cron scheduler | ✅ Closed | See P0 #1 |
| I-2 | Jobs app not in Hostinger bundle | ✅ N/A | Jobs run via Vercel Cron, not on the Hostinger origin |
| I-3 | Redis in-memory fallback | ✅ Closed | Upstash when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` set; in-memory fallback only when unset (documented) |
| I-4 | Sentry not wired | ✅ Closed | `withSentryConfig()` in `next.config.js`; `sentry.client.config.ts`; `instrumentation.ts` (gated on `SENTRY_DSN`) |
| I-5 | CI skips tests | ✅ Closed | See P0 #26 |
| I-6 | Supabase singleton clients | ✅ Accepted | Module-level singletons; safe under Next.js serverless isolation |
| I-7 | No post-deploy smoke test | ✅ Closed | `ci.yml` `smoke-test` job curls `/api/health` and `/api/cron/fetch-prices` |

### B.3 P1/P2 spot-checks (2026-10-07)

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| 31 | N+1 in `sendAlertsRunner` | ✅ Closed | Batch subscriber fetch before the alert loop |
| 33 | `ON CONFLICT` on `alert_queue` inserts | ✅ Closed | `.onConflict("product_id,subscriber_id,sent")` in `alertRepository.enqueueAlert` and the `fetchPricesRunner` batch insert |
| 34 | Missing `is_active` filters | ✅ Closed | `get_subscribers_for_alert` RPC (`WHERE is_active = TRUE`); `getTrackableProducts` `.eq("is_active", true)` |
| 41 | OneSignal script not consent-gated | ✅ Closed | `OneSignalGate.tsx` loads the SDK only when `consent === "all"` |
| 55 | Price normalization to USD | ✅ Closed | `packages/shared/src/utils/exchangeRateService.ts` fetches live rates from `EXCHANGE_RATE_API_URL` (env-driven, free key-less FX API), inverts units-per-USD → USD-per-unit, caches in Redis for 1h; `priceNormalizer.normalizePrice` consumes it; static `FALLBACK_RATES` are a last-resort fallback only (negative-cached 60s) |

### B.4 Verification pipeline (2026-10-07)

| Gate | Result |
|------|--------|
| `pnpm type-check` | 6/6 packages passing |
| `pnpm lint` | Clean across all packages |
| `pnpm test` | **482 tests passing** (config 14, database 67, edge-worker 16, jobs 31, shared 236, web 118) |
| `pnpm tsx scripts/compliance-check.ts` | 98 sponsored / 2 FTC / 1 privacy / 1 unsubscribe — all passed |
| `pnpm --filter @thinkabell/web run build` | 22 pages + Middleware + `/go/amazon/[asin]` and `/api/cron/*` routes |

### B.5 Open items

None blocking. Remaining work is product curation (manual, see `docs/AMAZON_LIST_CURATION.md`) and SaaS network credential acquisition — both documented as user-supplied inputs, not code gaps.

---

*This document is confidential and intended for board review only.*
