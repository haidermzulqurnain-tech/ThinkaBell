# ThinkaBell 12-Month P&L (Realistic Assessment)

**Date:** 2026-10-07 (revised)
**Currency:** USD
**Period:** Month 1 - Month 12
**Scenarios:** Conservative / Base / Aggressive
**Status:** REVISED. This document supersedes the 2026-09-12 draft, which projected $36,550-$146,200 Year 1 revenue on a $3.00 blended ARPU. That model was arithmetically wrong (break-even claimed at 35 MAU; the real figure is 348 MAU even at $3.00 ARPU) and operationally wrong (every revenue stream was assumed live while none exists). See `docs/PRE_LAUNCH_AUDIT.md` sections 2 and 9.

---

## Current Revenue Status: $0

Every revenue path is blocked today. This is the real assessment of the codebase:

| Revenue stream | Blocker |
|---|---|
| Amazon affiliate (physical goods) | Catalog is synthetic placeholder data (`scripts/seed-50-products.ts` generates randomized ASINs); real curation not yet performed (`docs/AMAZON_LIST_CURATION.md`). New Associates accounts also receive `AssociateNotEligible` (HTTP 403) from the PA-API until ~10 qualifying sales land in 30 days, so live price fetching is gated at launch. |
| SaaS affiliate (NordVPN, MacPaw, Raycast, etc.) | PartnerStack / AppSumo / Impact credentials not obtained. The clients are implemented but fail closed (return no data) until configured. |
| Sponsored placements | No infrastructure exists. |
| Premium subscriptions | No billing, no payment processor, no feature gate. |

**Realized revenue to date: $0.**

---

## Assumptions

- Month 1 launches with the placeholder catalog; real curation is a prerequisite blocker, not a launch feature.
- Waitlist beta of 50 users in Week 3 (target).
- Public launch at start of Month 2 - **NO-GO** until the unblock plan below is executed (audit recommendation).
- All infrastructure stays within free tiers until MRR >= $500.
- No paid acquisition until CAC validates at <= $5/user (current realistic CAC is $15-$40).

---

## Realistic Unit Economics

| Component | Original assumption | Realistic contribution |
|---|---|---|
| Affiliate (physical, 2% commission) | $0.50/MAU/year | $0.10-$0.30/MAU/year |
| Affiliate (SaaS, 30% commission) | $2.00/MAU/year | $0 (all SaaS data is simulated until credentials exist) |
| Sponsored placements | $0.30/MAU/year | $0 (no infrastructure exists) |
| Premium subscriptions | $0.20/MAU/year | $0 (no billing, no payment processing) |
| **Total** | **$3.00/MAU/year** | **$0.10-$0.30/MAU/year** |

- Realistic blended ARPU: **$0.10-$0.30/MAU/year** (affiliate physical only).
- Realistic CAC: **$15-$40** (even at zero paid spend, founder time + content creation is $10-$30/user).
- LTV:CAC at these unit economics is far below the 3:1 target; 3:1 is mathematically impossible until ARPU rises or CAC falls.

---

## Revenue Projection

Trajectory (audit-corrected): 50 beta users M1-3, 100 MAU M4-6, 200 MAU M7-12.
Revenue is affiliate-only, computed from the realistic ARPU range (ARPU / 12 per month).

| Month | Conservative MAU | Base MAU | Aggressive MAU | Conservative ($0.10) | Base ($0.20) | Aggressive ($0.30) |
|---|---|---|---|---|---|---|
| 1-3 | 50 | 50 | 50 | $0.42/mo | $0.83/mo | $1.25/mo |
| 4-6 | 100 | 100 | 100 | $0.83/mo | $1.67/mo | $2.50/mo |
| 7-12 | 200 | 200 | 200 | $1.67/mo | $3.33/mo | $5.00/mo |
| **Year 1 total** | | | | **$13.75** | **$27.50** | **$41.25** |

**Year 1 affiliate-only total: ~$14-$41.**

The audit's corrected headline of **$2,400-$6,000 gross Year 1** is reachable only if SaaS commissions, sponsored placements, and premium billing are built and credentialed mid-year. Each requires work that does not exist yet. Treat $2,400-$6,000 as a contingent upper bound from the unblock plan, not a forecast.

---

## Operating Expenses

| Category | Monthly Cost | Annual Cost | Notes |
|---|---|---|---|
| Hostinger VPS | $0-$12 | $0-$144 | Free tier or shared plan |
| Cloudflare Pro | $0-$20 | $0-$240 | Free tier sufficient for Month 1-3 |
| Supabase | $0-$25 | $0-$300 | Free tier until 50K MAU |
| Redis Cloud | $0-$5 | $0-$60 | Free tier |
| Brevo | $0-$25 | $0-$300 | Free tier 9,000 emails/mo |
| OneSignal | $0 | $0 | Free tier 10,000 subscribers |
| Domain (thinkabell.click) | $1.50 | $18 | Annual renewal |
| **Total (Conservative/Base)** | **$1.50-$87** | **$18-$1,062** | |
| **Total (Aggressive)** | **$1.50-$142** | **$18-$1,704** | Cloudflare Pro + paid tiers |

---

## Profit & Loss Summary

| Scenario | Year 1 Gross | Year 1 Expenses | Year 1 Net (cash only) | Year 1 Net (incl. founder time) |
|---|---|---|---|---|
| Realistic (affiliate-only) | $14-$41 | $18-$1,062 | **-$1,048 to +$23** | **-$5,000 to -$10,000** |
| Contingent upper bound (streams unlocked mid-year) | $2,400-$6,000 | $18-$1,062 | **+$1,338 to +$4,982** | **-$5,000 to -$10,000** |

---

## Break-Even Analysis

- Cash expenses at paid-tier transition: ~$87/month = $1,044/year.
- At the original (wrong) $3.00 ARPU: **348 MAU** breaks even ($1,044/year). The 2026-09-12 draft claimed 35 MAU, which is arithmetically wrong: 35 x $3 = $105/year = $8.75/month against $87/month of expenses - a $78.25 monthly deficit.
- At the realistic $0.10-$0.30 ARPU: **3,480-10,440 MAU** to break even on cash expenses.
- Expected break-even: **not reachable in Year 1** under the realistic model.

---

## MRR Gates

| MRR | Action |
|---|---|
| < $500 | $0 paid spend; all free tiers |
| $500-$1,500 | Upgrade Brevo if email volume > 9K/mo |
| $1,500-$5,000 | Add Sentry + PostHog paid tiers |
| > $5,000 | Evaluate Vercel Pro or Cloudflare Pages |

---

## Path to Real Revenue (unblock plan)

1. **Curate the catalog** - replace synthetic seed data with real products per `docs/AMAZON_LIST_CURATION.md`. Prerequisite for any affiliate revenue.
2. **Clear PA-API eligibility** - generate ~10 qualifying sales within 30 days to lift the `AssociateNotEligible` 403 gate on live price fetching.
3. **Obtain SaaS network credentials** - PartnerStack, AppSumo, and Impact API keys. Clients are already implemented and fail closed until configured.
4. **Build billing** - payment processor + feature gate. No premium revenue can exist before this.
5. **Build sponsored-placement infrastructure** - no sponsored revenue can exist before this.
6. **Organic growth only** - no paid acquisition until CAC validates at <= $5/user.

---

## Approval

- [ ] CFO reviewed and approved
- [ ] CEO signed off on free-tier operational budget
- [ ] Board acknowledged MRR gates
- [ ] CEO acknowledged NO-GO status until the unblock plan is executed
