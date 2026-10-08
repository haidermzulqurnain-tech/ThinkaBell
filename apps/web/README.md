# @thinkabell/web

Next.js 14+ frontend for ThinkaBell deal alerts and price tracking.

## Pages

- `/` — Homepage with deal cards and search
- `/deal/[slug]` — Deal detail page with trust metrics and affiliate routing
- `/subscribe` — Subscribe page for deal alerts
- `/legal/privacy-policy` — Privacy policy
- `/legal/terms-of-service` — Terms of service

## API Routes

- `GET /api/health` — Health check
- `POST /api/subscribe` — Create/update subscriber
- `GET /api/retailer-links` — Get retailer links for a product
- `GET /api/retailer-links/sponsored` — Get sponsored retailer for a product
- `POST /api/retailer-links/[id]/click` — Record affiliate click
- `GET /api/cron/fetch-prices` — Vercel Cron endpoint for price fetching
- `GET /api/cron/send-alerts` — Vercel Cron endpoint for alert dispatch

## Scripts

```bash
pnpm --filter @thinkabell/web dev
pnpm --filter @thinkabell/web build
pnpm --filter @thinkabell/web lint
pnpm --filter @thinkabell/web type-check
pnpm --filter @thinkabell/web test
```

## Testing

```bash
pnpm --filter @thinkabell/web test
```
