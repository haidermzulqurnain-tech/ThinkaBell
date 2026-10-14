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

/**
 * A Supabase-managed project host is `<project-ref>.supabase.co` (also `.in`
 * and `.red`), where the ref is a lowercase alphanumeric token. A custom
 * domain fronting the Supabase API gateway is also legitimate, so anything
 * that is not a `*.supabase.*` host is accepted as-is.
 *
 * This is a shape rule, not a denylist: the placeholder Hostname shipped in
 * .env.example (`your-project.supabase.co`) fails because its label contains a
 * hyphen and is too short to be a ref, so a copied placeholder is reported
 * instead of silently being pointed at a host that does not exist.
 */
function isSupabaseHostValue(value: string): boolean {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  // TLS remotely; plain http only for a local Supabase CLI instance.
  if (parsed.protocol === "http:") {
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  }
  if (parsed.protocol !== "https:") return false;

  const managed = /^([a-z0-9-]+)\.supabase\.(co|in|red)$/i.exec(parsed.hostname);
  if (!managed) return true; // custom domain — cannot be validated by shape
  return /^[a-z0-9]{10,}$/i.test(managed[1] ?? "");
}

/**
 * Supabase issues either a JWT (`header.payload.signature`, the legacy anon
 * and service-role keys) or a new-style `sb_publishable_…` / `sb_secret_…`
 * key. Both are recognisable from shape, so a copied placeholder such as
 * `your-supabase-anon-key` is caught without naming it.
 */
function isSupabaseKeyShape(value: string): boolean {
  return (
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value) ||
    /^sb_(publishable|secret)_[A-Za-z0-9_-]+$/.test(value)
  );
}

/** A Supabase URL where one is present. Empty stays "not configured". */
const supabaseUrl = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value === "" ? "" : value.trim()))
  .refine((value) => value === "" || isSupabaseHostValue(value), {
    message: "not a Supabase project URL (expected https://<project-ref>.supabase.co)",
  });

/**
 * A Supabase key where one is present. Unlike the URL this fails closed: a
 * value that is not a JWT or an `sb_` key cannot authenticate against Supabase,
 * so it is dropped rather than used, and reported by variable name.
 */
const supabaseKey = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value === "" ? "" : value.trim()))
  .refine((value) => value === "" || isSupabaseKeyShape(value), {
    message: "not a Supabase key (expected a JWT or an sb_publishable_/sb_secret_ key)",
  });

/**
 * Alternative names an operator or another integration may have used for the
 * Supabase credentials.
 *
 * The canonical names are the five above. These aliases exist because the same
 * value has several widely-used spellings: Supabase's own dashboard labels the
 * pair "Publishable key" / "Secret key" (yielding `*_PUBLISHABLE_KEY` /
 * `*_SECRET_KEY`), Next.js' own env naming produces `NEXT_PUBLIC_SUPABASE_KEY`,
 * and Vite/Supabase templates use `SUPABASE_API_KEY` and a `VITE_` prefix. A
 * deployment that used any of those would otherwise look completely unconfigured
 * — non-empty on the host, empty to the schema — with no indication of why.
 *
 * Order matters when more than one is set, so each list runs from the most
 * specific to the most ambiguous. `SUPABASE_PUBLISHABLE_KEY` is unambiguous — in
 * Supabase's key model it is by definition the client-side key — whereas
 * `SUPABASE_API_KEY` is a legacy generic name that has held an anon key, a
 * service-role key, and a placeholder depending on who set it. Preferring the
 * one whose meaning is fixed is why the specific spellings come first.
 *
 * Read in order; the first candidate that is set wins, and a canonical variable
 * that is already set always takes precedence over every alias. Each alias is
 * recorded so the startup log and /api/health can name the exact spelling in
 * use instead of silently accepting it: resolving the value fixes the
 * deployment, reporting the spelling tells the operator how to normalise it.
 */
const SUPABASE_CREDENTIAL_ALIASES: Record<string, readonly string[]> = {
  SUPABASE_URL: ["SUPABASE_PROJECT_URL", "NEXT_PUBLIC_SUPABASE_PROJECT_URL"],
  SUPABASE_ANON_KEY: [
    // Most specific first: this one is definitionally the anonymous key.
    "SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    // Ambiguous legacy naming — only used when the specific spellings are absent.
    "SUPABASE_API_KEY",
    "NEXT_PUBLIC_SUPABASE_API_KEY",
    "NEXT_PUBLIC_SUPABASE_KEY",
    "NEXT_PUBLIC_ANON_KEY",
  ],
  SUPABASE_SERVICE_ROLE_KEY: [
    // By definition the service-side key in Supabase's key model.
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SECRET_API_KEY",
    "SUPABASE_SERVICE_KEY",
  ],
};

/**
 * Alternative names for the remaining credentials. Same mechanism, and reported
 * the same way, as the Supabase aliases above — these exist because the same
 * value is named differently in each vendor's dashboard and in each template.
 * impact.com's UI calls the Account SID the "Account SID", but a deployment
 * following impact.com's docs may well use IMPACT_ACCOUNT_ID, which is the same
 * identifier.
 */
const OTHER_CREDENTIAL_ALIASES: Record<string, readonly string[]> = {
  IMPACT_ACCOUNT_SID: ["IMPACT_ACCOUNT_ID"],
  IMPACT_AUTH_TOKEN: ["IMPACT_API_KEY", "IMPACT_AUTH_TOKEN_ID"],
};

const CREDENTIAL_ALIASES: Record<string, readonly string[]> = {
  ...SUPABASE_CREDENTIAL_ALIASES,
  ...OTHER_CREDENTIAL_ALIASES,
};

/**
 * Copies an alias into its canonical variable when the canonical one is not
 * set. Mutates `source` so the rest of parsing is unchanged. Returns which
 * substitutions were made so they can be reported.
 */
function resolveCredentialAliases(
  source: NodeJS.ProcessEnv,
): Array<{ canonical: string; alias: string }> {
  const applied: Array<{ canonical: string; alias: string }> = [];

  for (const [canonical, aliases] of Object.entries(CREDENTIAL_ALIASES)) {
    if (readSourceValue(source[canonical]) !== undefined) continue;
    for (const alias of aliases) {
      const value = readSourceValue(source[alias]);
      if (value !== undefined) {
        source[canonical] = source[alias];
        applied.push({ canonical, alias });
        break;
      }
    }
  }

  return applied;
}

let _aliasNotes: Array<{ canonical: string; alias: string }> = [];

/** The aliases resolved into canonical variables on the last `getEnv()` call. */
export function getCredentialAliasesUsed(): Array<{ canonical: string; alias: string }> {
  getEnv();
  return [..._aliasNotes];
}

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),

  // Application
  NEXT_PUBLIC_APP_URL: z.string().url().default("https://thinkabell.click"),

  // Supabase (empty when unconfigured — the database client fails closed).
  // Both are validated for shape so a placeholder copied from .env.example is
  // reported by name instead of pointing the client at a host that does not
  // exist, which leaves Supabase showing no connections at all.
  SUPABASE_URL: supabaseUrl,
  SUPABASE_ANON_KEY: supabaseKey,
  SUPABASE_SERVICE_ROLE_KEY: supabaseKey,
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseKey,

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
  // (GET /MediaPartners/{AccountSID}/Campaigns).
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
  // Name the consequence, which differs by what was rejected: variables that
  // were merely unset keep their default, while a value the host delivered and
  // that was rejected is inert until the host is corrected.
  const affected = issues.filter((issue) => issue.delivered);
  if (affected.length > 0) {
    console.error(
      `   Values are deliberately not logged. ${affected.length} delivered value(s) were dropped, ` +
        `so anything depending on ${affected.map((issue) => issue.variable).join(", ")} is inactive ` +
        "until the host is corrected.",
    );
  } else {
    console.error(
      "   Values are deliberately not logged. These were unset, so their defaults apply.",
    );
  }
}

/** Reports which non-canonical credential names were resolved, and how to normalise them. */
function reportCredentialAliases(aliases: Array<{ canonical: string; alias: string }>): void {
  if (aliases.length === 0) return;
  console.warn(
    `⚠️ [Config] Using ${aliases.length} credential(s) under a non-canonical name. ` +
      "The values resolved and the integrations will work, but rename them to the canonical " +
      "variable so the setup matches the documentation:",
  );
  for (const { canonical, alias } of aliases) {
    console.warn(`   - ${alias} → ${canonical}`);
  }
}

export function getEnv(): Env {
  if (_env) return _env;

  // Resolve aliases before validation, so an operator who used a different
  // spelling still gets a connected deployment rather than a silent
  // "unconfigured".
  _aliasNotes = resolveCredentialAliases(process.env);
  const { env: parsed, issues } = parseEnvFields(process.env);
  _env = parsed;
  _issues = issues;
  reportIssues(issues);
  reportCredentialAliases(_aliasNotes);

  return _env;
}

/**
/**
 * Credentials whose absence disables a feature outright rather than degrading
 * it. The health endpoint's `status` means "the app answers", not "every
 * integration is configured" — so these are reported separately, and named,
 * because each one is a dead path the operator cannot otherwise see.
 *
 * `alternatives` lists accepted alias names: a credential counts as set when any
 * one of its names carries a value, which is what makes an aliased deployment
 * read as configured instead of missing.
 */
export const FAIL_CLOSED_CREDENTIALS: ReadonlyArray<{
  variable: string;
  purpose: string;
  security: boolean;
  alternatives: readonly string[];
}> = [
  {
    variable: "AMAZON_PARTNER_TAG",
    purpose:
      "Amazon affiliate links fail closed — no link is emitted, so no commission can be attributed",
    security: false,
    alternatives: [],
  },
  {
    variable: "REVALIDATION_SECRET",
    purpose: "POST /api/revalidate rejects every request — cached pages never purge",
    security: false,
    alternatives: [],
  },
  {
    variable: "RETAILER_LINKS_API_KEY",
    purpose: "POST /api/retailer-links rejects every request",
    security: false,
    alternatives: [],
  },
  {
    variable: "ENCRYPTION_KEY",
    purpose: "subscriber emails and push tokens are stored in plaintext",
    security: true,
    alternatives: [],
  },
  {
    variable: "BLIND_INDEX_KEY",
    purpose: "subscriber lookups fall back to lower(email) — not a security control",
    security: true,
    alternatives: [],
  },
  {
    variable: "AMAZON_LIST_URLS",
    purpose: "the credential-free discovery source is inert — nothing populates the catalogue",
    security: false,
    alternatives: [],
  },
];

/**
 * The fail-closed credentials that are unset, considering every accepted alias
 * name. `getEnv()` resolves aliases into the canonical variable, so the
 * canonical name is checked first and the alternatives as a fallback.
 */
export function getUnsetFailClosedCredentials(): Array<{
  variable: string;
  purpose: string;
  security: boolean;
  alternatives: readonly string[];
}> {
  getEnv();
  return FAIL_CLOSED_CREDENTIALS.filter((entry) =>
    [entry.variable, ...entry.alternatives].every(
      (name) => readSourceValue(process.env[name]) === undefined,
    ),
  );
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
  _aliasNotes = [];
}

export const env = getEnv();
