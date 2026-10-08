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

### Worker secrets (fail-closed)

The worker fails closed (5xx) when configuration is missing — it never redirects or proxies with placeholder values. Set these as Worker secrets:

| Secret | Purpose |
| --- | --- |
| `ORIGIN_URL` | Hostinger origin base URL the worker proxies to (e.g. `https://thinkabell.click`). Unset → `503`. |
| `AMAZON_US_TAG` | Affiliate tag for `www.amazon.com` (US) |
| `AMAZON_GB_TAG` | Affiliate tag for `www.amazon.co.uk` (GB) |
| `AMAZON_DE_TAG` | Affiliate tag for `www.amazon.de` (DE) |
| `AMAZON_CA_TAG` | Affiliate tag for `www.amazon.ca` (CA) |

```bash
pnpm --filter @thinkabell/edge-worker exec wrangler secret put ORIGIN_URL
pnpm --filter @thinkabell/edge-worker exec wrangler secret put AMAZON_US_TAG
# ...repeat for AMAZON_GB_TAG, AMAZON_DE_TAG, AMAZON_CA_TAG
```

Optional: `DEFAULT_COUNTRY` (default `US`) — used when Cloudflare provides no country.

Behaviour:

- `/go/amazon/:asin` → `302` redirect to the visitor's regional Amazon store with the configured tag. Countries without a dedicated store fall back to the US store. Invalid ASINs → `400`. Missing tag for the resolved store → `500` (fail closed).
- All other paths → proxied to `ORIGIN_URL`. The worker injects `x-thinkabell-country` / `x-thinkabell-city` headers derived from Cloudflare's `cf` data (client-supplied `x-thinkabell-*` headers are stripped first so they cannot be spoofed) and adds `X-Edge-Served-By`, `X-Detected-Country`, and `X-Frame-Options: DENY` to responses.

Then enable the Worker route by uncommenting it in `wrangler.toml`:

```toml
routes = [
  { pattern = "thinkabell.click/*", zone_name = "thinkabell.click" }
]
```

---

## 7. App Integration (Geo-Routed Deal Links)

The web app generates the same geo-routed contract natively, so
geo-personalized Amazon links work on **every** deployment
topology — at the edge when the worker fronts the site, or on
the Hostinger origin when deployed directly:

- **Deal & True Cost CTAs**: when a product has a resolvable
  ASIN (`products.amazon_asin`) and the visitor's marketplace
  has a partner tag configured, the "View Deal" CTA points to
  the same-origin `/go/amazon/:asin` route instead of a
  hard-coded storefront URL. When geo routing fails closed
  (no ASIN, or the marketplace's tag is unconfigured), the CTA
  falls back to the stored affiliate URL — never a placeholder.
- **`/go/amazon/:asin` origin route** (`apps/web/app/go/amazon/[asin]`):
  mirrors the worker contract — `400` for malformed ASINs,
  `503` when the visitor's marketplace tag is unconfigured,
  otherwise `302` to the regional storefront with the regional
  partner tag.
- **`/api/route-link`**: commission-routed clicks on Amazon
  links are re-routed through `/go/amazon/:asin` so the
  highest-commission retailer still receives the click with the
  visitor's regional tag; non-Amazon links are untouched.

### Geo resolution order (storefront selection only — never authorization)

1. `x-vercel-ip-country` — set by Vercel's edge when deployed on Vercel.
2. `x-thinkabell-country` — injected by the edge-worker proxy;
   honored only when `EDGE_PROXY_TRUSTED=true` (on direct
   deployments the header is client-controllable and must not
   be trusted).
3. Otherwise the configured default marketplace
   (`AMAZON_LIST_MARKETPLACE`) applies.

The modular resolver lives in `packages/shared/src/api/georouter.ts`
and is covered by unit tests (`georouter.test.ts`).
