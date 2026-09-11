# ThinkaBell Official Launch & Operations Playbook

This operational playbook details the pre-launch checklist, content marketing templates, social media syndication, and post-launch maintenance routines for **thinkabell.click**.

---

## 1. Pre-Launch Verification Checklist

- [ ] **Supabase Database Initialized**:
  - Run `packages/database/schema.sql` in Supabase SQL editor.
  - Verify tables: `products`, `price_history`, `subscribers`, `alert_queue`.
  - Confirm Row Level Security (RLS) is active on all 4 tables.
  - Run `pnpm run seed` or run `packages/database/seed.sql` to populate 100+ starter deals.
- [ ] **DNS & Cloudflare Configured**:
  - Domain `thinkabell.click` pointed to Cloudflare nameservers.
  - SSL/TLS set to **Full (strict)**.
  - Page Rule enabled for caching HTML (Cache Everything, 5 min TTL).
  - Brotli and Always Online toggled ON.
- [ ] **Hostinger Deployment Tested**:
  - Application running on Node 20 or 22.
  - Startup file set to `hostinger-server.js`.
  - Health check responds `200 OK` at `https://thinkabell.click/api/health`.
- [ ] **Trigger.dev Jobs Active**:
  - Deploy jobs via `npx trigger.dev@latest deploy`.
  - Verify `fetch-prices` (every 15m) and `send-alerts` (every 5m) in dashboard.
- [ ] **OneSignal & MailerLite Configured**:
  - OneSignal App ID added for Web Push permissions.
  - MailerLite API key configured for email alert delivery.

---

## 2. MailerLite Welcome Sequence Template

When a new subscriber signs up via `https://thinkabell.click/subscribe`, automate the following 2-part welcome email sequence:

### Email 1: Welcome & Deal Confirmation (Immediate)
- **Subject**: Welcome to ThinkaBell! Your deal alerts are now live 🔔
- **Preview Text**: We scan hardware and software prices 24/7 so you never overpay.
- **Body**:
  > Hey there,
  >
  > Welcome to ThinkaBell! You’ve successfully activated automated deal tracking.
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

---

## 5. Ongoing Maintenance & Operations

1. **Alert Queue Purging**:
   - `alert_queue` records can be cleaned up monthly with:
     ```sql
     DELETE FROM alert_queue WHERE sent = true AND created_at < NOW() - INTERVAL '30 days';
     ```
2. **Rate Limit Audits**:
   - Monitor Amazon PA-API usage (stay under 1 request/second).
   - Monitor eBay Browse API calls (stay under 5,000 calls/day free tier).
