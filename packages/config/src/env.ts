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

  // Supabase
  SUPABASE_URL: z.string().default("https://your-project.supabase.co"),
  SUPABASE_ANON_KEY: z.string().default("anon-key-placeholder"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default("service-role-key-placeholder"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),

  // Amazon PA-API
  AMAZON_ACCESS_KEY: z.string().default(""),
  AMAZON_SECRET_KEY: z.string().default(""),
  AMAZON_PARTNER_TAG: z.string().default("thinkabell-20"),
  AMAZON_REGION: z.string().default("us-east-1"),

  // eBay Browse API
  EBAY_CLIENT_ID: z.string().default(""),
  EBAY_CLIENT_SECRET: z.string().default(""),
  EBAY_AFFILIATE_CAMPAIGN_ID: z.string().default(""),

  // OneSignal Push
  ONESIGNAL_APP_ID: z.string().default(""),
  ONESIGNAL_REST_API_KEY: z.string().default(""),
  NEXT_PUBLIC_ONESIGNAL_APP_ID: z.string().default(""),

  // MailerLite Email
  MAILERLITE_API_KEY: z.string().default(""),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().default(""),
  UPSTASH_REDIS_REST_TOKEN: z.string().default(""),

  // Analytics & Monitoring
  NEXT_PUBLIC_POSTHOG_KEY: z.string().default(""),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().default("https://app.posthog.com"),
  SENTRY_DSN: z.string().default(""),
  NEXT_PUBLIC_SENTRY_DSN: z.string().default(""),

  // Trigger.dev
  TRIGGER_SECRET_KEY: z.string().default(""),
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

export const env = getEnv();
