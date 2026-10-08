# ThinkaBell Data Processing Agreement (DPA) Review

**Date:** 2026-09-12  
**Prepared by:** Legal / Compliance  
**Status:** Initiated — Pending signatures

---

## 1. Purpose

This document tracks the Data Processing Agreements (DPAs) required for ThinkaBell to operate compliantly under GDPR, UK GDPR, CCPA/CPRA, and other applicable privacy frameworks.

---

## 2. Subprocessors Requiring DPAs

| Subprocessor | Data Type | Purpose | Jurisdiction | DPA Status |
|---|---|---|---|---|
| **Brevo** (formerly Sendinblue) | Email addresses, alert preferences, unsubscribe status | Transactional and marketing email delivery | EU (Brevo SAS) | ⏳ Initiated |
| **OneSignal** | Push subscription tokens, device metadata | Web push notifications | US | ⏳ Initiated |
| **Redis Cloud** | Cached price data, session state | In-memory caching layer | EU/US | ⏳ Initiated |
| **Supabase** | Product metadata, subscriber records, click events | Primary database and auth | US/EU | ⏳ Initiated |
| **Cloudflare** | IP addresses, request metadata | CDN, DDoS protection, geo-routing | US | ⏳ Initiated |
| **Hostinger** | Server logs, access logs | Application hosting | EU (Lithuania) | ⏳ Initiated |
| **Vercel** (optional) | Build artifacts, edge logs | Frontend deployment | US | ⏳ Initiated |

---

## 3. GDPR Article 28 Requirements

Each DPA must include:

- [ ] Subject-matter limitation: processing limited to ThinkaBell's instructions
- [ ] Purpose limitation: only for stated notification and caching purposes
- [ ] Data minimization: only necessary fields processed
- [ ] Retention period: defined per data type
- [ ] Security measures: encryption in transit and at rest
- [ ] Subprocessor list: approved subprocessors enumerated
- [ ] Audit rights: ThinkaBell may audit compliance annually
- [ ] Data breach notification: 72-hour SLA
- [ ] Data deletion: return/delete all data on contract termination
- [ ] EU representative: designated where required

---

## 4. Data Retention Schedule

| Data Type | Retention | Disposal Method |
|---|---|---|
| Subscriber email + preferences | Until unsubscribe + 30 days | DELETE |
| Alert queue records | 30 days post-send | DELETE |
| Click tracking events | 90 days | DELETE |
| Price history | 12 months | ARCHIVE then DELETE |
| Server logs | 30 days | DELETE |
| Error logs (Sentry) | 90 days | DELETE |

---

## 5. Cookie Consent & Geo-IP Routing

- **Default (unknown jurisdiction):** Show consent banner; block non-essential cookies until consent.
- **EU/UK:** Strict consent required before any analytics or marketing cookies.
- **US:** Opt-out model acceptable; still enforce consent for EU visitors.
- **Geo-IP:** Use Cloudflare `CF-IPCountry` header to route privacy policy variant.

---

## 6. Breach Response Protocol

1. **Detection:** Automated alerting via Sentry / uptime monitor.
2. **Assessment:** Determine if personal data is affected within 24 hours.
3. **Notification:** Notify supervisory authority within 72 hours if high risk.
4. **Remediation:** Patch, rotate secrets, and document root cause.
5. **Communication:** Notify affected users within 7 days if material impact.

---

## 7. Action Items

| Owner | Task | Deadline |
|---|---|---|
| Legal | Send DPA request to Brevo | Week 1 |
| Legal | Send DPA request to OneSignal | Week 1 |
| Legal | Send DPA request to Redis Cloud | Week 1 |
| CTO | Confirm Supabase DPA in place | Week 1 |
| CTO | Confirm Cloudflare DPA in place | Week 1 |
| CTO | Confirm Hostinger DPA in place | Week 1 |
| CISO | Rotate all placeholder keys | Week 1 |
| CTO | Implement cookie-consent tracker blocking | Week 2 |
| Legal | Review and sign all returned DPAs | Week 3 |

---

## 8. Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| CEO | | | |
| CFO | | | |
| CTO | | | |
| CISO | | | |
| Legal / Compliance | | | |

---

*This document is confidential and intended for board review only.*
