# Cloudflare CDN, Edge Caching & Worker Setup

This guide details how to configure Cloudflare for **thinkabell.click** for maximum performance, global edge caching, and automated affiliate link localization.

---

## 1. Domain & Nameservers

1. Log into your [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Click **Add a Domain** and enter `thinkabell.click`.
3. Choose the **Free** plan.
4. Review existing DNS records pulled from Hostinger:
   - `A` record for `@` pointing to Hostinger IP
   - `CNAME` for `www` pointing to `thinkabell.click`
5. At your domain registrar (Namecheap, Hostinger, GoDaddy, etc.), replace existing nameservers with the two assigned Cloudflare nameservers (e.g. `adam.ns.cloudflare.com`, `beth.ns.cloudflare.com`).
6. Allow 5–30 minutes for DNS propagation.

---

## 2. SSL/TLS Configuration (Full Strict)

1. In Cloudflare, navigate to **SSL/TLS** -> **Overview**.
2. Select **Full (strict)**.
   - This ensures full end-to-end encryption between visitor -> Cloudflare Edge -> Hostinger Origin server.
3. In **SSL/TLS** -> **Edge Certificates**:
   - Turn **Always Use HTTPS** to **ON**.
   - Turn **Automatic HTTPS Rewrites** to **ON**.
   - Set **Minimum TLS Version** to **TLS 1.2**.

---

## 3. Edge Page Rules / Cache Rules

To cache HTML responses for anonymous users while protecting authenticated/dynamic routes:

1. Navigate to **Caching** -> **Cache Rules** (or **Rules** -> **Page Rules**).
2. Click **Create Rule**.
3. Configure the rule:
   - **Rule Name**: `Cache HTML & Static Content`
   - **When incoming requests match**:
     - `URI Path` does not start with `/api/`
     - AND `Cookie` does not contain `session`
   - **Then**:
     - **Cache Eligibility**: Eligible for cache
     - **Edge Cache TTL**: 5 minutes (`300 seconds`)
     - **Browser Cache TTL**: 1 minute (`60 seconds`)
     - **Serve Stale Content while Revalidating**: Enabled

---

## 4. Performance Optimizations

1. Navigate to **Speed** -> **Optimization**:
   - **Brotli Compression**: Turn **ON** (compresses text/JSON/HTML by up to 20% more than gzip).
   - **Early Hints**: Turn **ON**.
   - **HTTP/3 (with QUIC)**: Turn **ON**.
   - **0-RTT Connection Resumption**: Turn **ON**.

---

## 5. Always Online Setup

1. Navigate to **Caching** -> **Configuration**.
2. Locate **Always Online**.
3. Toggle to **ON**.
   - If Hostinger's origin server ever experiences downtime, Cloudflare will automatically serve cached versions of your deal pages from the Internet Archive crawl cache.

---

## 6. Cloudflare Worker Deployment (Geo-Targeting)

The edge worker in `packages/edge-worker/` automatically detects visitor countries and rewrites Amazon links:

```bash
# In packages/edge-worker
pnpm wrangler login
pnpm wrangler deploy
```
