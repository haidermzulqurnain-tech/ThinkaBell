# @thinkabell/config

Zod-based runtime environment validation and application config for ThinkaBell.

## Usage

```typescript
import { getEnv, env } from "@thinkabell/config";

const config = getEnv();
console.log(config.SUPABASE_URL);
```

## Environment Variables

See `src/env.ts` for the full Zod schema. Key variables:
- `NODE_ENV`, `PORT`
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `AMAZON_ACCESS_KEY`, `AMAZON_SECRET_KEY`, `AMAZON_PARTNER_TAG`, `AMAZON_REGION`
- `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_AFFILIATE_CAMPAIGN_ID`
- `WALMART_API_KEY`, `WALMART_AFFILIATE_ID`, `WALMART_AFFILIATE_TRACK_ID`
- `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`
- `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `SENTRY_DSN`, `TRIGGER_SECRET_KEY`

## Testing

```bash
pnpm --filter @thinkabell/config test
```
