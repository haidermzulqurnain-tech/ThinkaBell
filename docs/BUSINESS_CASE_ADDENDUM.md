# ThinkaBell Business Case Addendum

**Date:** 2026-09-12  
**Prepared for:** Board of Directors  
**Status:** Sprint 0 — Pre-Launch Validation

---

## 1. Problem Statement

Consumers and SMBs overpay for software, hardware, and SaaS tools because:
- Price changes are fragmented across retailers, marketplaces, and vendor sites.
- Deal aggregators lack transparency, affiliate disclosure, and verified price history.
- Alert tools (e.g., CamelCamelCamel) do not cover SaaS or developer tools.

ThinkaBell solves this by unifying price tracking across physical goods and SaaS, with verified affiliate links, transparent FTC disclosures, and configurable alerts.

---

## 2. Target Market

| Segment | Examples | Estimated TAM |
|---|---|---|
| Developer / Prosumer hardware | Laptops, monitors, NVMe, peripherals | $4.2B |
| AI hardware | Accelerators, dev kits, sensors | $1.8B |
| SaaS / software deals | Productivity, dev tools, AI APIs | $2.5B |
| SMB procurement | Bulk licensing, seat-based tools | $1.1B |

**Serviceable market (Year 1):** US/EU/UK independent developers and 1–50 person startups.

---

## 3. Value Proposition

- **Trust:** Every affiliate link is marked `rel="sponsored"`. FTC disclosures are visible above the fold on every deal page.
- **Freshness:** Prices are refreshed on a schedule (currently every 6 hours via Vercel Cron); alerts fire only when a verified drop exceeds the user's threshold.
- **Flexibility:** Users choose email (Brevo), web push (OneSignal), or both. Alert threshold is configurable.
- **Transparency:** Alert quality score explains why an alert was sent; true-cost calculator reveals TCO for SaaS subscriptions.

---

## 4. Revenue Model

| Stream | Mechanism | Rate | Year 1 Target |
|---|---|---|---|
| Affiliate commissions | Amazon Associates, eBay, Walmart, SaaS networks | 1–4% | $45K ARR |
| Sponsored placements | Retailer link slots on deal pages | CPM / flat | $18K ARR |
| Premium subscriptions | Ad-free, advanced alerts, price history | $4.99/mo | $12K ARR |

**Blended revenue per MAU:** $0.18–$0.32

---

## 5. Go-to-Market Strategy

1. **Manual curation (Week 1–2):** Seed 50 high-quality deals across eBay + SaaS sim sources.
2. **Organic acquisition:** SEO-optimized deal pages, schema.org structured data, `/faq`, `/how-it-works`.
3. **Waitlist beta:** 50 users via invite-only landing page. Measure store-to-alert conversion and alert-to-store CTR.
4. **Compliance-first launch:** Privacy policy, ToS, cookie consent, DPA signatures, and CI compliance gates active before public launch.

---

## 6. Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Store-to-alert conversion | > 15% | Subscribe funnel |
| Alert-to-store CTR | > 10% | Brevo / OneSignal clicks |
| CAC | ≤ $5/user | Waitlist signup cost |
| Brevo delivery rate | > 95% | Brevo dashboard |
| OneSignal subscription rate | > 8% | Footer + modal prompts |
| Uptime | > 99.5% | UptimeRobot + `/api/health` |

---

## 7. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Low conversion | Medium | High | Pivot to manual curation + direct sales outreach |
| Brevo free-tier ceiling | Medium | High | Hard cap at 9,000 emails/month; add Telegram/Discord backup |
| Hostinger CPU throttling | Medium | High | Cloudflare cache rules + static generation |
| DPA delays | Medium | Critical | Defer EU/UK launch until DPAs signed |
| SaaS API simulation only | High | Medium | Replace with live APIs once credentials obtained |

---

## 8. Ask / Next Steps

- Approve 4-week MVP launch timeline.
- Authorize $0 paid spend until MRR ≥ $500.
- Confirm 50-product manual curation scope.
- Review 12-month P&L and approve free-tier operational budget.
