# @thinkabell/shared

Shared domain types, API clients, and utilities for ThinkaBell.

## Modules

- `src/types/index.ts` — Domain interfaces for products, alerts, subscribers, and retailers
- `src/api/amazonClient.ts` — Amazon PA-API client with fallback simulation
- `src/api/ebayClient.ts` — eBay Browse API client
- `src/api/walmartClient.ts` — Walmart API client
- `src/api/affiliateNetworkClient.ts` — PartnerStack/AppSumo/Impact abstraction
- `src/api/notificationClient.ts` — Brevo email + OneSignal push
- `src/api/retailerLinkClient.ts` — Retailer link lookup client
- `src/utils/retry.ts` — Exponential backoff retry helper
- `src/utils/circuitBreaker.ts` — Circuit breaker for external APIs
- `src/utils/rateLimit.ts` — Sliding-window rate limiter
- `src/utils/redis.ts` — Upstash Redis wrapper with in-memory fallback
- `src/utils/logger.ts` — Structured logger

## Testing

```bash
pnpm --filter @thinkabell/shared test
pnpm --filter @thinkabell/shared test:coverage
```
