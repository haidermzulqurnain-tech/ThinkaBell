import { z } from "zod";
import dotenv from "dotenv";

// Local .env files are read by dotenv for the runtime entrypoints that Next.js
// does not load them for (the jobs runner and the Hostinger standalone server).
// dotenv never overrides a variable already present in the environment, so any
// value the host delivers — Hostinger's environment variables included — wins.
dotenv.config();

/**
 * A Sentry DSN is `https://<publicKey>@<host>/<projectId>`.
 *
 * The public key is an opaque token, so shape is all that can be validated.
 * The rules below come from the DSN grammar rather than a denylist: the key
 * must be a single alphanumeric token and the project id a positive integer.
 * The example value shipped in .env.example
 * (`https://your-sentry-dsn@ingest.sentry.io/0`) fails both — its key contains
 * hyphens and its project id is 0 — so a placeholder copied from that file is
 * reported as an invalid value instead of being sent to Sentry, which rejects
 * it and logs `Invalid Sentry Dsn` on every boot.
 */
function isSentryDsnShape(value: string): boolean {
  const match = /^https?:\/\/([^@/]+)@[^/]+\/(\d+)$/.exec(value.trim());
  if (!match) return false;
  const key = match[1] ?? "";
  return /^[0-9A-Za-z]+$/.test(key) && Number(match[2]) > 0;
}

/**
 * Validates a Sentry DSN where one is present. An empty or absent value means
 * "not configured" and passes, so the unconfigured state stays legal.
 */
const sentryDsn = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value === "" ? "" : value.trim()))
  .refine((value) => value === "" || isSentryDsnShape(value), {
    message: "not a valid Sentry DSN (expected https://<key>@<host>/<projectId>)",
  });

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),

  // Application
  NEXT_PUBLIC_APP_URL: z.string().url().default("https://thinkabell.click"),

  // Supabase (empty when unconfigured — the database client fails closed).
  // The URL is validated so a typo reports the variable by name instead of
  // surfacing later as an opaque fetch failure; the transform keeps the
  // unconfigured state an empty string rather than undefined, and the default
  // is applied *after* validation so "" remains a legal unconfigured value.
  SUPABASE_URL: z
    .string()
    .url()
    .optional()
    .transform((value) => value ?? ""),
  SUPABASE_ANON_KEY: z.string().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(""),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
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
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default("https://app.posthog.com"),

  // Vercel Cron / Job Security
  CRON_SECRET: z.string().default(""),
  ALERTS_API_KEY: z.string().default(""),

  // Admin API keys (fail-closed: empty default rejects every request).
  // REVALIDATION_SECRET authorizes POST /api/revalidate (ISR cache purge).
  // RETAILER_LINKS_API_KEY authorizes POST /api/retailer-links (admin writes).
  REVALIDATION_SECRET: z.string().default(""),
  RETAILER_LINKS_API_KEY: z.string().default(""),

  // SaaS Affiliate Networks.
  // PartnerStack Partner API key (Bearer auth,
  // GET /api/v2/marketplace/programs).
  PARTNERSTACK_API_KEY: z.string().default(""),
  // Impact REST API credentials — HTTP Basic
  // auth: Account SID as the username, Auth
  // Token as the password
  // (GET /Mediapartners/{AccountSID}/Campaigns).
  IMPACT_ACCOUNT_SID: z.string().default(""),
  IMPACT_AUTH_TOKEN: z.string().default(""),
  // AppSumo needs no credentials: it publishes no
  // public deals API, so its client harvests the
  // server-rendered browse and product pages.

  // Error reporting. Both are empty until configured, and the Sentry init
  // sites skip initialization when unset — see isSentryDsnConfigured() below.
  // A value that is present but malformed (for example the placeholder shipped
  // in .env.example) is reported through getEnvIssues() rather than forwarded
  // to Sentry, which rejects it at boot.
  SENTRY_DSN: sentryDsn,
  NEXT_PUBLIC_SENTRY_DSN: sentryDsn,
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
});

export type Env = z.infer<typeof envSchema>;

/** An environment variable the host delivered that failed validation. */
export interface EnvIssue {
  /** The environment variable name, e.g. NEXT_PUBLIC_APP_URL. */
  variable: string;
  /** Why the delivered value was rejected. Never contains the value itself. */
  reason: string;
  /** True when a value was delivered and rejected; false when it was unset/empty. */
  delivered: boolean;
}

let _env: Env | null = null;
let _issues: EnvIssue[] = [];

/**
 * A blank value is treated as unset. Hosts commonly deliver an empty string
 * for a field left untouched, and `z.coerce.number()` would otherwise turn
 * `PORT=""` into 0.
 */
function readSourceValue(raw: string | undefined): string | undefined {
  return raw === undefined || raw === "" ? undefined : raw;
}

function firstIssueReason(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "invalid value";
  const path = issue.path.join(".") || "value";
  return issue.message ? `${path}: ${issue.message}` : path;
}

/**
 * Validates each field on its own.
 *
 * The previous implementation parsed the whole object in one `safeParse` and,
 * on any failure, fell back to `envSchema.parse({})` — which replaced *every*
 * value the host delivered with that field's default. A single malformed
 * variable (an app URL missing its scheme, a non-numeric PORT, a sender email
 * without a domain) therefore disabled the Supabase credentials too, and the
 * only signal was a `console.warn` nobody sees on a production host.
 *
 * Now a rejected field falls back to its own default and is reported through
 * {@link getEnvIssues}, so the surviving values keep working and the operator
 * is told exactly which variable to fix.
 */
function parseEnvFields(source: NodeJS.ProcessEnv): { env: Env; issues: EnvIssue[] } {
  const shape = envSchema.shape as Record<string, z.ZodTypeAny>;
  const values: Record<string, unknown> = {};
  const issues: EnvIssue[] = [];

  for (const [variable, schema] of Object.entries(shape)) {
    const raw = readSourceValue(source[variable]);
    const parsed = schema.safeParse(raw);

    if (parsed.success) {
      values[variable] = parsed.data;
      continue;
    }

    // Fall back to this field's own default rather than the whole object's.
    // A field with neither a default nor an optional wrapper cannot be
    // defaulted, so it stays unset and is still reported.
    const fallback = schema.safeParse(undefined);
    if (fallback.success) {
      values[variable] = fallback.data;
    }

    issues.push({ variable, reason: firstIssueReason(parsed.error), delivered: raw !== undefined });
  }

  return { env: values as Env, issues };
}

function reportIssues(issues: EnvIssue[]): void {
  if (issues.length === 0) return;

  const rejected = issues.filter((issue) => issue.delivered).length;
  console.error(
    `⚠️ [Config] ${issues.length} environment variable(s) rejected (${rejected} invalid, ` +
      `${issues.length - rejected} unset). Defaults applied; missing credentials are inert.`,
  );
  for (const issue of issues) {
    const state = issue.delivered ? "invalid value" : "unset";
    console.error(`   - ${issue.variable} (${state}): ${issue.reason}`);
  }
  console.error(
    "   Values are deliberately not logged. Fix the variables listed above; " +
      "the credentials the host did deliver keep working.",
  );
}

export function getEnv(): Env {
  if (_env) return _env;

  const { env: parsed, issues } = parseEnvFields(process.env);
  _env = parsed;
  _issues = issues;
  reportIssues(issues);

  return _env;
}

/**
 * The environment variables that were unset or rejected, for health reporting
 * and operator diagnostics. Names and reasons only — never values.
 */
export function getEnvIssues(): EnvIssue[] {
  getEnv();
  return [..._issues];
}

export function resetEnv() {
  _env = null;
  _issues = [];
}

export const env = getEnv();
