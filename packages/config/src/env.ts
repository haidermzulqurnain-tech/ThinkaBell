import { z } from "zod";
import dotenv from "dotenv";

// Load local environment files if not in production
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),

  // Application
  NEXT_PUBLIC_APP_URL: z.string().url().default("https://thinkabell.click"),

  // Supabase (empty when unconfigured — the database client fails closed)
  SUPABASE_URL: z.string().default(""),
  SUPABASE_ANON_KEY: z.string().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(""),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),

  // Amazon PA-API
  AMAZON_ACCESS_KEY: z.string().default(""),
  AMAZON_SECRET_KEY: z.string().default(""),
  AMAZON_PARTNER_TAG: z.string().default(""),
  AMAZON_REGION: z.string().default("us-east-1"),

  // Amazon regional affiliate tags (fail-closed link generation — no hardcoded
  // fallback tags). Empty means the marketplace is not configured.
  AMAZON_PARTNER_TAG_UK: z.string().default(""),
  AMAZON_PARTNER_TAG_DE: z.string().default(""),
  AMAZON_PARTNER_TAG_CA: z.string().default(""),

  // Amazon List Curation (manual data curation, no API, no credentials).
  // JSON array of publicly curated Amazon Lists, e.g.:
  // [{"url":"https://www.amazon.com/hz/wishlist/ls/EXAMPLE","marketplace":"US"}]
  AMAZON_LIST_URLS: z.string().default(""),
  // Default marketplace used for list items without an explicit one.
  AMAZON_LIST_MARKETPLACE: z.string().default("US"),
  // Maximum items harvested per list.
  AMAZON_LIST_MAX_ITEMS: z.coerce.number().default(100),
  // Delay in ms between consecutive list fetches (polite rate limiting).
  AMAZON_LIST_FETCH_DELAY_MS: z.coerce.number().default(1000),

  // Edge proxy trust (anti-spoofing control). When "true", the origin
  // honors the x-thinkabell-country header injected by the Cloudflare
  // edge-worker proxy. Keep "false" on direct deployments where the
  // header is client-controllable. Never used for authorization decisions.
  EDGE_PROXY_TRUSTED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  // eBay Browse API
  EBAY_CLIENT_ID: z.string().default(""),
  EBAY_CLIENT_SECRET: z.string().default(""),
  EBAY_AFFILIATE_CAMPAIGN_ID: z.string().default(""),

  // Walmart API
  WALMART_API_KEY: z.string().default(""),
  WALMART_AFFILIATE_ID: z.string().default(""),
  WALMART_AFFILIATE_TRACK_ID: z.string().default(""),

  // Affiliate attribution label. Applied as the eBay customid and
  // the direct-link ref parameter; utm_source is derived from
  // NEXT_PUBLIC_APP_URL. Configurable per deployment (white-label,
  // staging) instead of hardcoded in link-building logic.
  AFFILIATE_ATTRIBUTION_ID: z.string().default("thinkabell"),

  // OneSignal Push
  ONESIGNAL_APP_ID: z.string().default(""),
  ONESIGNAL_REST_API_KEY: z.string().default(""),
  NEXT_PUBLIC_ONESIGNAL_APP_ID: z.string().default(""),

  // Brevo Email
  BREVO_API_KEY: z.string().default(""),
  BREVO_SENDER_EMAIL: z.string().email().default("noreply@thinkabell.click"),
  BREVO_SENDER_NAME: z.string().default("ThinkaBell"),
  // Contact form recipient (falls back to BREVO_SENDER_EMAIL when unset)
  CONTACT_EMAIL: z.string().email().optional(),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().default(""),
  UPSTASH_REDIS_REST_TOKEN: z.string().default(""),

  // Exchange Rates (price normalization). Free, key-less FX API
  // returning units-per-USD rates (e.g. frankfurter.app). Rates are
  // cached in Redis for 1 hour; static fallback rates apply only
  // when the API is unreachable.
  EXCHANGE_RATE_API_URL: z.string().url().default("https://api.frankfurter.app/latest"),

  // Analytics & Monitoring
  NEXT_PUBLIC_POSTHOG_KEY: z.string().default(""),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().default("https://app.posthog.com"),
  SENTRY_DSN: z.string().default(""),
  NEXT_PUBLIC_SENTRY_DSN: z.string().default(""),

  // Vercel Cron / Job Security
  CRON_SECRET: z.string().default(""),
  ALERTS_API_KEY: z.string().default(""),

  // Admin API keys (fail-closed: empty default rejects every request).
  // REVALIDATION_SECRET authorizes POST /api/revalidate (ISR cache purge).
  // RETAILER_LINKS_API_KEY authorizes POST /api/retailer-links (admin writes).
  REVALIDATION_SECRET: z.string().default(""),
  RETAILER_LINKS_API_KEY: z.string().default(""),

  // SaaS Affiliate Networks
  APPSUMO_API_KEY: z.string().default(""),
  IMPACT_API_KEY: z.string().default(""),
  IMPACT_ACCOUNT_ID: z.string().default(""),
  PARTNERSTACK_API_KEY: z.string().default(""),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (_env) return _env;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.warn("⚠️ [Config] Environment validation warnings:", parsed.error.format());
    // Fallback with defaults
    _env = envSchema.parse({});
  } else {
    _env = parsed.data;
  }

  return _env;
}

export function resetEnv() {
  _env = null;
}

export const env = getEnv();
