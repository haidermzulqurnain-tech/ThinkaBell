/**
 * @file scripts/check-live.ts
 * @description Comprehensive live-run diagnostic covering connections,
 *   performance, and security on the deployed host.
 *
 * Every probe is independent and modular: one failing probe does not block
 * another. Values come only from env — no hardcoded credentials, no mocks,
 * no placeholders. Failures are reported with named causes and actions,
 * never collapsed into generic "unhealthy".
 *
 * Usage on the host:
 *   pnpm tsx scripts/check-live.ts            # human-readable summary
 *   pnpm tsx scripts/check-live.ts --json     # machine-readable for monitoring
 *
 * Exit code is 0 only when every configured connection probe passes and no
 * security header is missing. Performance results are always reported but
 * never flip the exit code — a slow endpoint is a finding, not a blocker.
 */

import { env, getEnvIssues } from "@thinkabell/config";
import { getSupabaseAnonClient } from "@thinkabell/database";

/** Milliseconds before any probe is considered unreachable. */
const TIMEOUT_MS = 10_000;

interface ProbeResult {
  category: "connection" | "performance" | "security" | "config";
  service: string;
  status: "ok" | "warn" | "fail" | "unset";
  detail: string;
  ms?: number;
  action?: string;
}

const results: ProbeResult[] = [];

function record(
  category: ProbeResult["category"],
  service: string,
  status: ProbeResult["status"],
  detail: string,
  options: { ms?: number; action?: string } = {},
): void {
  results.push({ category, service, status, detail, ...options });
}

/** Last 4 characters of a secret — confirm set without revealing. */
function tail(value: string | undefined): string {
  if (!value) return "(unset)";
  return `…${value.slice(-4)}`;
}

/** Generic timed fetch probe. */
async function timedFetch(
  url: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; ms: number; detail: string }> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const ms = Date.now() - start;
    return {
      ok: response.status < 500,
      status: response.status,
      ms,
      detail: `answered HTTP ${response.status} in ${ms}ms`,
    };
  } catch (error) {
    const ms = Date.now() - start;
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? `no response within ${TIMEOUT_MS}ms`
        : error instanceof Error
          ? error.message
          : String(error);
    return { ok: false, status: 0, ms, detail: `unreachable (${reason})` };
  } finally {
    clearTimeout(timer);
  }
}

/** True when at least one canonical variable is non-empty. */
function configured(names: string[]): boolean {
  return names.some((name) => Boolean(env[name as keyof typeof env]));
}

/** Shape-based placeholder detection: a real key has a documented prefix. */
function placeholderReason(
  variable: string,
  value: string,
  prefix: string,
): string | undefined {
  if (!value || value.startsWith(prefix)) return undefined;
  return `${variable} does not start with "${prefix}" as a real key does`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Config probes
// ─────────────────────────────────────────────────────────────────────────────

function configProbes(): void {
  const issues = getEnvIssues().filter((issue) => issue.delivered);
  for (const issue of issues) {
    record(
      "config",
      issue.variable,
      "fail",
      `rejected: ${issue.reason}`,
      { action: "fix or unset this variable; a placeholder breaks the integration" },
    );
  }

  const aliasesUsed: string[] = [];
  const canonicalCheck = [
    { alias: "SUPABASE_PUBLISHABLE_KEY", canonical: "SUPABASE_ANON_KEY" },
    { alias: "IMPACT_ACCOUNT_ID", canonical: "IMPACT_ACCOUNT_SID" },
    { alias: "IMPACT_API_KEY", canonical: "IMPACT_AUTH_TOKEN" },
  ] as const;
  for (const { alias, canonical } of canonicalCheck) {
    if (env[alias as keyof typeof env] && !env[canonical as keyof typeof env]) {
      aliasesUsed.push(`${alias}→${canonical}`);
    }
  }
  if (aliasesUsed.length > 0) {
    record(
      "config",
      "credential naming",
      "warn",
      `resolved via non-canonical name(s): ${aliasesUsed.join(", ")}`,
      { action: "rename to the canonical variable so the setup matches documentation" },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Connection probes
// ─────────────────────────────────────────────────────────────────────────────

async function supabaseConnection(): Promise<void> {
  try {
    const supabase = getSupabaseAnonClient();
    const start = Date.now();
    const { error } = await supabase.from("products").select("id").limit(1);
    const ms = Date.now() - start;
    if (error) {
      record(
        "connection",
        "Supabase",
        "fail",
        `query failed: ${error.message} (code ${error.code ?? "n/a"})`,
        {
          ms,
          action: "401/403 = wrong key; 42501 = RLS; otherwise see Supabase status page",
        },
      );
    } else {
      record(
        "connection",
        "Supabase",
        "ok",
        `read from "products" through the app's anon client`,
        { ms },
      );
    }
  } catch (error) {
    record(
      "connection",
      "Supabase",
      "fail",
      error instanceof Error ? error.message : "unreachable",
      { action: "set SUPABASE_URL and a publishable/anon key" },
    );
  }
}

async function brevoConnection(): Promise<void> {
  if (!configured(["BREVO_API_KEY"])) {
    record("connection", "Brevo", "unset", "not configured");
    return;
  }
  const prefix = "xkeysib-";
  const placeholder = placeholderReason("BREVO_API_KEY", env.BREVO_API_KEY!, prefix);
  if (placeholder) {
    record("connection", "Brevo", "fail", `placeholder value — ${placeholder}`, {
      action: "set a real BREVO_API_KEY from app.brevo.com → SMTP & API → API Keys",
    });
    return;
  }
  const { ok, status, ms, detail } = await timedFetch(
    "https://api.brevo.com/v3/account",
    { headers: { "api-key": env.BREVO_API_KEY!, Accept: "application/json" } },
  );
  if (ok) {
    record("connection", "Brevo", "ok", detail, { ms });
  } else if (status >= 500) {
    record("connection", "Brevo", "fail", detail, {
      ms,
      action: "provider being down — retry shortly",
    });
  } else {
    record("connection", "Brevo", "fail", `the service rejected the credential (${status})`, {
      ms,
      action: "re-copy BREVO_API_KEY; a key copied with whitespace is the usual cause",
    });
  }
}

async function onesignalConnection(): Promise<void> {
  if (!configured(["ONESIGNAL_APP_ID", "ONESIGNAL_REST_API_KEY"])) {
    record("connection", "OneSignal", "unset", "not configured");
    return;
  }
  const url = new URL("https://onesignal.com/api/v1/apps");
  url.searchParams.set("auth_key", env.ONESIGNAL_REST_API_KEY!);
  const { ok, status, ms, detail } = await timedFetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (ok) {
    record("connection", "OneSignal", "ok", detail, { ms });
  } else if (status >= 500) {
    record("connection", "OneSignal", "fail", detail, {
      ms,
      action: "provider being down — retry shortly",
    });
  } else {
    record("connection", "OneSignal", "fail", `the service rejected the credential (${status})`, {
      ms,
      action: "re-copy ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY from dashboard.onesignal.com → Settings → Keys & IDs",
    });
  }
}

async function impactConnection(): Promise<void> {
  if (!configured(["IMPACT_ACCOUNT_SID", "IMPACT_AUTH_TOKEN"])) {
    record("connection", "Impact", "unset", "not configured");
    return;
  }
  const sid = env.IMPACT_ACCOUNT_SID!;
  const { ok, status, ms, detail } = await timedFetch(
    `https://api.impact.com/MediaPartners/${encodeURIComponent(sid)}/Campaigns`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${env.IMPACT_AUTH_TOKEN!}`).toString("base64")}`,
        Accept: "application/json",
      },
    },
  );
  if (ok) {
    record("connection", "Impact", "ok", detail, { ms });
  } else if (status >= 500) {
    record("connection", "Impact", "fail", detail, {
      ms,
      action: "provider being down — retry shortly",
    });
  } else {
    record("connection", "Impact", "fail", `the service rejected the credential (${status})`, {
      ms,
      action: "re-copy IMPACT_ACCOUNT_SID / IMPACT_AUTH_TOKEN from app.impact.com",
    });
  }
}

async function partnerStackConnection(): Promise<void> {
  if (!configured(["PARTNERSTACK_API_KEY"])) {
    record("connection", "PartnerStack", "unset", "not configured");
    return;
  }
  const { ok, status, ms, detail } = await timedFetch(
    "https://api.partnerstack.com/api/v2/marketplace/programs",
    {
      headers: {
        Authorization: `Bearer ${env.PARTNERSTACK_API_KEY!}`,
        Accept: "application/json",
      },
    },
  );
  if (ok) {
    record("connection", "PartnerStack", "ok", detail, { ms });
  } else if (status >= 500) {
    record("connection", "PartnerStack", "fail", detail, {
      ms,
      action: "provider being down — retry shortly",
    });
  } else {
    record("connection", "PartnerStack", "fail", `the service rejected the credential (${status})`, {
      ms,
      action: "re-copy PARTNERSTACK_API_KEY from dashboard.partnerstack.com → Settings → API Keys",
    });
  }
}

async function upstashConnection(): Promise<void> {
  if (!configured(["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"])) {
    record("connection", "Upstash Redis", "unset", "not configured");
    return;
  }
  const { ok, status, ms, detail } = await timedFetch(
    `${env.UPSTASH_REDIS_REST_URL!}/ping/`,
    {
      headers: {
        Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN!}`,
        Accept: "application/json",
      },
    },
  );
  if (ok) {
    record("connection", "Upstash Redis", "ok", detail, { ms });
  } else if (status >= 500) {
    record("connection", "Upstash Redis", "fail", detail, {
      ms,
      action: "provider being down — retry shortly",
    });
  } else {
    record("connection", "Upstash Redis", "fail", `the service rejected the credential (${status})`, {
      ms,
      action: "re-copy UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from console.upstash.com",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Performance probes
// ─────────────────────────────────────────────────────────────────────────────

async function endpointPerformance(path: string, label: string): Promise<void> {
  const base = env.NEXT_PUBLIC_APP_URL;
  if (!base) {
    record("performance", label, "unset", "NEXT_PUBLIC_APP_URL not set — cannot measure live endpoint");
    return;
  }
  const url = base.replace(/\/$/, "") + path;
  const { ok, status, ms, detail } = await timedFetch(url, {
    headers: { Accept: "text/html, application/json" },
  });
  const statusText = ok ? `HTTP ${status}` : `HTTP ${status}`;
  const perfStatus = ms > 3000 ? "warn" : "ok";
  record(
    "performance",
    label,
    perfStatus,
    `${detail} (${statusText})`,
    { ms, action: ms > 3000 ? "endpoint exceeds 3s — investigate database query, cold start, or egress" : undefined },
  );
}

async function performanceProbes(): Promise<void> {
  await endpointPerformance("/api/health", "Health endpoint");
  await endpointPerformance("/api/cron/fetch-prices", "Cron fetch-prices");
  await endpointPerformance("/api/alerts", "Alerts endpoint");
}

// ─────────────────────────────────────────────────────────────────────────────
// Security probes
// ─────────────────────────────────────────────────────────────────────────────

async function securityHeaders(path: string, label: string): Promise<void> {
  const base = env.NEXT_PUBLIC_APP_URL;
  if (!base) {
    record("security", label, "unset", "NEXT_PUBLIC_APP_URL not set — cannot check headers");
    return;
  }
  const url = base.replace(/\/$/, "") + path;
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let headers: Headers | null = null;
  try {
    const response = await fetch(url, { method: "HEAD", signal: controller.signal });
    headers = response.headers;
  } catch {
    // fall through — header check unavailable
  } finally {
    clearTimeout(timer);
  }
  if (!headers) {
    record("security", label, "fail", "could not retrieve response headers");
    return;
  }

  const required = [
    { name: "X-Content-Type-Options", value: "nosniff" },
    { name: "X-Frame-Options", value: /^(DENY|SAMEORIGIN)$/ },
    { name: "Referrer-Policy", value: /^(no-referrer|strict-origin|strict-origin-when-cross-origin)$/ },
  ];
  let missing = 0;
  for (const { name, value } of required) {
    const actual = headers.get(name);
    if (!actual) {
      missing += 1;
      record("security", label, "fail", `missing security header: ${name}`, {
        action: `set ${name} in next.config.js headers or middleware`,
      });
    } else if (value instanceof RegExp && !value.test(actual)) {
      missing += 1;
      record("security", label, "fail", `weak security header: ${name}=${actual}`, {
        action: `harden ${name} to ${value}`,
      });
    }
  }
  if (missing === 0) {
    record("security", label, "ok", "all required security headers present");
  }

  // Cache-control on API routes should not be public
  const cacheControl = headers.get("Cache-Control");
  if (cacheControl && /public/.test(cacheControl) && /api/.test(path)) {
    record("security", label, "warn", `API route ${path} has public Cache-Control: ${cacheControl}`, {
      action: "use private/no-cache for API routes that return user-specific data",
    });
  }
}

async function securityProbes(): Promise<void> {
  await securityHeaders("/api/health", "Health endpoint");
  await securityHeaders("/api/cron/fetch-prices", "Cron endpoint");
  await securityHeaders("/api/alerts", "Alerts endpoint");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const json = process.argv.includes("--json");

  configProbes();

  // Connections run in parallel — independent of each other
  await Promise.all([
    supabaseConnection(),
    brevoConnection(),
    onesignalConnection(),
    impactConnection(),
    partnerStackConnection(),
    upstashConnection(),
  ]);

  // Performance probes run against the live host
  await performanceProbes();

  // Security probes run against the live host
  await securityProbes();

  const failures = results.filter((r) => r.status === "fail");
  const warnings = results.filter((r) => r.status === "warn");
  const configuredCount = results.filter(
    (r) => r.status !== "unset" && r.category !== "performance" && r.category !== "security",
  ).length;
  const allOk = failures.length === 0;

  if (json) {
    console.log(
      JSON.stringify(
        {
          allOk,
          summary: {
            configuredConnections: configuredCount,
            failures: failures.length,
            warnings: warnings.length,
          },
          results,
        },
        null,
        2,
      ),
    );
  } else {
    const mark = (s: ProbeResult["status"]) => (s === "ok" ? "✓" : s === "warn" ? "⚠" : s === "fail" ? "✗" : "-");
    console.log("");
    console.log("Live-run diagnostic — connections, performance, security");
    console.log("──────────────────────────────────────────────────────────");
    for (const r of results) {
      const ms = r.ms ? ` (${r.ms}ms)` : "";
      console.log(`${mark(r.status)} [${r.category}] ${r.service.padEnd(24)}${ms} ${r.detail}`);
      if (r.action) console.log(`    → ${r.action}`);
    }
    console.log("");
    console.log(
      allOk
        ? `RESULT: all ${configuredCount} configured connections passing. ${warnings.length} warning(s).`
        : `RESULT: ${failures.length} failure(s), ${warnings.length} warning(s). Fix the failures above first.`,
    );
    console.log("");
  }

  process.exit(allOk ? 0 : 1);
}

void main();
