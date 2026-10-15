/**
 * @file scripts/check-connections.ts
 * @description Verifies each configured external integration actually answers
 *   and authenticates — not merely that its variables are set.
 *
 * The health endpoint reports what is configured; this reports what works. The
 * gap it closes is a credential that is present but wrong, which is otherwise
 * indistinguishable from a good one: the alert job runs, the send returns
 * `false`, and the only symptom is that no notification arrives.
 *
 * Every probe is read-only. Endpoints are the providers' account/quota reads,
 * never their send paths, so running this cannot send an email or a push.
 *
 * Usage:
 *   pnpm tsx scripts/check-connections.ts            # summary
 *   pnpm tsx scripts/check-connections.ts --verbose  # include unconfigured services
 *   pnpm tsx scripts/check-connections.ts --json     # machine-readable
 *
 * Exit code is 0 only when every *configured* service is reachable and
 * authenticates. Services whose variables are unset are reported as "unset",
 * not as failures, so a minimal deployment passes.
 */

import { env, getEnvIssues } from "@thinkabell/config";
import { getSupabaseAnonClient } from "@thinkabell/database";

/** Milliseconds before a probe is considered unreachable. */
const TIMEOUT_MS = 10_000;

interface ProbeResult {
  service: string;
  status: "ok" | "unset" | "fail";
  detail: string;
  /** Present when the service is configured but rejecting or unreachable. */
  action?: string;
}

/**
 * A read-only endpoint that proves the credentials work.
 *
 * `variables` are the canonical names resolved by `getEnv()`; `headers` builds
 * the auth for the request; `expectOk` is what counts as success, because the
 * providers differ (Brevo returns 200 for an account, Impact returns 200 for a
 * campaigns list, and a 404 from either means the credentials are wrong rather
 * than the service being down).
 */
interface Probe {
  service: string;
  variables: string[];
  /**
   * The provider's documented key prefix, where one exists. Lets this report
   * "placeholder" rather than "rejected": a copied example needs a different fix
   * from a wrong credential. Shape-based, not a denylist of known example
   * strings, so it does not go stale when a vendor renames its example value.
   */
  prefix?: string;
  run: () => Promise<{ ok: boolean; detail: string; action?: string }>;
}

function placeholderReason(p: Probe): string | undefined {
  if (!p.prefix) return undefined;
  for (const variable of p.variables) {
    const value = String(env[variable as keyof typeof env] ?? "");
    if (!value || value.startsWith(p.prefix)) continue;
    return `${variable} does not start with "${p.prefix}" as a real ${p.service} key does`;
  }
  return undefined;
}

async function probe(
  url: string,
  init: RequestInit,
  okWhen: (status: number) => boolean,
  failureAction: string,
): Promise<{ ok: boolean; detail: string; action?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });

    if (okWhen(response.status)) {
      return { ok: true, detail: `answered ${response.status}` };
    }

    // The remedy must match the cause: a 5xx is the provider being down, and
    // telling the operator to re-copy a working key wastes their time.
    if (response.status >= 500) {
      return {
        ok: false,
        detail: `the service is failing (HTTP ${response.status})`,
        action:
          "not a credential problem — retry shortly; if it persists, check the provider's status page",
      };
    }

    const hint =
      response.status === 401 || response.status === 403
        ? "the service rejected the credential"
        : `unexpected status ${response.status}`;
    return { ok: false, detail: hint, action: failureAction };
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? `no response within ${TIMEOUT_MS}ms`
        : error instanceof Error
          ? error.message
          : String(error);
    return { ok: false, detail: `unreachable (${reason})`, action: failureAction };
  } finally {
    clearTimeout(timer);
  }
}

/** True when at least one of the canonical variables is non-empty. */
function configured(names: string[]): boolean {
  return names.some((name) => Boolean(env[name as keyof typeof env]));
}

/** The account/quota read for Brevo. `GET /v3/account` needs only the key. */
function brevoProbe(): Probe {
  return {
    service: "Brevo (email)",
    variables: ["BREVO_API_KEY"],
    prefix: "xkeysib-",
    run: async () =>
      probe(
        "https://api.brevo.com/v3/account",
        {
          headers: { "api-key": env.BREVO_API_KEY, Accept: "application/json" },
        },
        (status) => status === 200,
        "re-copy BREVO_API_KEY from app.brevo.com → SMTP & API → API Keys; a key copied with whitespace is the usual cause",
      ),
  };
}

/**
 * OneSignal has no unauthenticated account read, so this uses the apps listing,
 * which is scoped to the app and is still read-only.
 */
function oneSignalProbe(): Probe {
  return {
    service: "OneSignal (push)",
    variables: ["ONESIGNAL_APP_ID", "ONESIGNAL_REST_API_KEY"],
    run: async () => {
      const url = new URL("https://onesignal.com/api/v1/apps");
      url.searchParams.set("auth_key", env.ONESIGNAL_REST_API_KEY);
      return probe(
        url.toString(),
        { headers: { Accept: "application/json" } },
        (status) => status === 200,
        "re-copy ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY from dashboard.onesignal.com → Settings → Keys & IDs",
      );
    },
  };
}

/**
 * Impact is read-only against the campaigns list, which is also the endpoint the
 * app itself calls — so this verifies the exact request that must succeed.
 */
function impactProbe(): Probe {
  return {
    service: "Impact",
    variables: ["IMPACT_ACCOUNT_SID", "IMPACT_AUTH_TOKEN"],
    run: async () => {
      const sid = env.IMPACT_ACCOUNT_SID;
      return probe(
        `https://api.impact.com/MediaPartners/${encodeURIComponent(sid)}/Campaigns`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${env.IMPACT_AUTH_TOKEN}`).toString("base64")}`,
            Accept: "application/json",
          },
        },
        (status) => status === 200,
        "check the path casing is MediaPartners, and re-copy IMPACT_ACCOUNT_SID / IMPACT_AUTH_TOKEN from app.impact.com",
      );
    },
  };
}

/** PartnerStack's marketplace listing, also the endpoint the app calls. */
function partnerStackProbe(): Probe {
  return {
    service: "PartnerStack",
    variables: ["PARTNERSTACK_API_KEY"],
    run: async () =>
      probe(
        "https://api.partnerstack.com/api/v2/marketplace/programs",
        {
          headers: {
            Authorization: `Bearer ${env.PARTNERSTACK_API_KEY}`,
            Accept: "application/json",
          },
        },
        (status) => status === 200,
        "re-copy PARTNERSTACK_API_KEY from dashboard.partnerstack.com → Settings → API Keys",
      ),
  };
}

/** Upstash over REST: a GET on the REST URL authenticates without writing. */
function upstashProbe(): Probe {
  return {
    service: "Upstash Redis",
    variables: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    run: async () =>
      probe(
        `${env.UPSTASH_REDIS_REST_URL}/ping/`,
        {
          headers: {
            Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
            Accept: "application/json",
          },
        },
        (status) => status === 200,
        "re-copy UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from console.upstash.com → Database → REST API",
      ),
  };
}

/** Sentry: the DSN shape is already validated, so this only reports it. */
function sentryProbe(): Probe {
  return {
    service: "Sentry",
    variables: ["SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"],
    run: async () => {
      const dsn = env.SENTRY_DSN || env.NEXT_PUBLIC_SENTRY_DSN;
      if (!dsn) {
        return { ok: false, detail: "no DSN configured" };
      }
      // Deliberately not a network call: sending an event to confirm a DSN is
      // real is a side effect. The shape check is what verifies it.
      const project = /\/\d+$/.test(dsn) ? dsn.replace(/^https?:\/\//, "") : "(unparsed)";
      return { ok: true, detail: `DSN configured for ${project}` };
    },
  };
}

/** Supabase is deep-checked by check-supabase-connection.ts; reuse that view. */
async function supabaseProbe(): Promise<ProbeResult> {
  try {
    const supabase = getSupabaseAnonClient();
    const { error } = await supabase.from("products").select("id").limit(1);
    if (error) {
      return {
        service: "Supabase",
        status: "fail",
        detail: error.message,
        action: "see docs/HOSTINGER_DEPLOYMENT.md — the URL or key is likely wrong",
      };
    }
    return {
      service: "Supabase",
      status: "ok",
      detail: "query through the app's anon client succeeded",
    };
  } catch (error) {
    return {
      service: "Supabase",
      status: "fail",
      detail: error instanceof Error ? error.message : "unreachable",
      action: "set SUPABASE_URL and a publishable/anon key",
    };
  }
}

function buildProbes(): Probe[] {
  return [
    brevoProbe(),
    oneSignalProbe(),
    impactProbe(),
    partnerStackProbe(),
    upstashProbe(),
    sentryProbe(),
  ];
}

async function main(): Promise<void> {
  const verbose = process.argv.includes("--verbose");
  const json = process.argv.includes("--json");

  const results: ProbeResult[] = [await supabaseProbe()];

  for (const p of buildProbes()) {
    if (!configured(p.variables)) {
      if (verbose) results.push({ service: p.service, status: "unset", detail: "not configured" });
      continue;
    }

    // A placeholder reports as itself, not as a rejected credential: the fix is
    // to supply a real key, not to re-copy the one already there.
    const placeholder = placeholderReason(p);
    if (placeholder) {
      results.push({
        service: p.service,
        status: "fail",
        detail: `placeholder value — ${placeholder}`,
        action: `set a real ${p.service} key; the current value looks like an example`,
      });
      continue;
    }

    const outcome = await p.run();
    results.push({
      service: p.service,
      status: outcome.ok ? "ok" : "fail",
      detail: outcome.detail,
      action: outcome.action,
    });
  }

  // The config check catches malformed values; reported here so one run shows
  // both "is it valid" and "does it answer".
  const envIssues = getEnvIssues().filter((issue) => issue.delivered);

  const configuredCount = results.filter((r) => r.status !== "unset").length;
  const failures = results.filter((r) => r.status === "fail");
  const allOk = failures.length === 0 && envIssues.length === 0;

  if (json) {
    console.log(
      JSON.stringify(
        { connected: allOk, results, rejectedVariables: envIssues.map((i) => i.variable) },
        null,
        2,
      ),
    );
  } else {
    console.log("");
    console.log("External service connections");
    console.log("────────────────────────────");
    for (const r of results) {
      const mark = r.status === "ok" ? "✓" : r.status === "fail" ? "✗" : "-";
      console.log(`${mark} ${r.service.padEnd(18)} ${r.detail}`);
      if (r.action) console.log(`    → ${r.action}`);
    }
    if (envIssues.length > 0) {
      console.log("");
      console.log(
        `Rejected variable(s), so their integration is inert: ${envIssues
          .map((i) => i.variable)
          .join(", ")}`,
      );
    }
    console.log("");
    console.log(
      allOk
        ? `RESULT: ${configuredCount} service(s) configured, all answering.`
        : `RESULT: ${configuredCount} service(s) configured, ${failures.length} failing.`,
    );
    console.log("");
  }

  process.exit(allOk ? 0 : 1);
}

void main();
