# @thinkabell/web

Next.js 15 (App Router) frontend for ThinkaBell deal alerts and price tracking.

## Pages

- `/` — Homepage with deal cards and search
- `/deals`, `/search`, `/compare` — listings (filters via query params)
- `/deal/[slug]` — Deal detail page with trust metrics and affiliate routing
- `/true-cost/[slug]` — True-cost breakdown
- `/subscribe` — Subscribe page for deal alerts
- `/unsubscribe/confirmed` — Unsubscribe confirmation
- `/legal/privacy-policy`, `/legal/terms-of-service` — Legal pages
- `/go/amazon/[asin]` — Amazon affiliate redirect

## API Routes

- `GET /api/health` — Health check (database, cache, and env-config diagnostics)
- `POST /api/subscribe` — Create/update subscriber
- `GET /api/retailer-links` — Get retailer links for a product
- `GET /api/retailer-links/sponsored` — Get sponsored retailer for a product
- `POST /api/retailer-links/[id]/click` — Record affiliate click
- `POST /api/cron/product-discovery` — populate products (cron, bearer auth)
- `POST /api/cron/fetch-prices` — price fetching (cron, bearer auth)
- `POST /api/cron/send-alerts` — alert dispatch (cron, bearer auth)

`/api/cron/*` endpoints are invoked by Vercel Cron or Supabase `pg_cron` — see `apps/jobs/README.md` for the schedules.

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

Tests run under `vitest` with the `jsdom` environment and the shared
`vitest.setup.ts` at the repository root. `@testing-library/*` and `jsdom`
are declared in this package's devDependencies.
