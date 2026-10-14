/**
 * @file scripts/check-supabase-connection.ts
 * @description Verifies that the app can actually reach Supabase, and names the
 *   failure precisely when it cannot.
 *
 * "Hostinger says the connection is configured but Supabase shows nothing" has
 * three distinct causes, and they need different fixes, so they are reported
 * separately rather than collapsed into one error:
 *
 *   1. CONFIG    — a variable is unset or malformed. A placeholder such as
 *                 `https://your-project.supabase.co` passes a presence check
 *                 but resolves to a host that does not exist.
 *   2. REACH     — the project host is not reachable from here: DNS, TLS, or
 *                 an egress restriction on the host.
 *   3. AUTH      — the host is reachable but the key is rejected (401/403).
 *   4. DATA      — the key is accepted but a table query fails, which is an
 *                 RLS or schema problem rather than a connection one.
 *
 * Run it wherever the app runs — it uses the same client and the same variable
 * names as the app, so it reports the app's view, not a second opinion.
 *
 * Usage:
 *   pnpm tsx scripts/check-supabase-connection.ts [--table products] [--json]
 *
 * Exit code is 0 only when a real query succeeds.
 */

import { getSupabaseAnonClient } from "@thinkabell/database";
import { env, getEnvIssues } from "@thinkabell/config";

/** Milliseconds before a request to Supabase is considered unreachable. */
const TIMEOUT_MS = 10_000;

type Stage = "config" | "node" | "reach" | "auth" | "data";
type Status = "pass" | "fail" | "skip";

interface Result {
  stage: Stage;
  ok: boolean;
  detail: string;
}

const results: Result[] = [];

function record(stage: Stage, ok: boolean, detail: string): void {
  results.push({ stage, ok, detail });
}

/** Last 4 characters of a secret, so a value can be confirmed set without being shown. */
function tail(value: string | undefined): string {
  if (!value) return "(unset)";
  return `…${value.slice(-4)}`;
}

/** The label used for an unset variable, so the operator knows the exact name. */
const REQUIRED_URL = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"];
const REQUIRED_KEY = ["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];

function parseArgs(argv: string[]): { table: string; json: boolean } {
  let table = "products";
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--table") {
      const value = argv[i + 1];
      if (!value) {
        console.error("--table requires a value");
        process.exit(2);
      }
      table = value;
      i += 1;
    } else if (argv[i] === "--json") {
      json = true;
    }
  }
  return { table, json };
}

/**
 * Node 22 is a hard requirement of @supabase/supabase-js (its engines field is
 * `>=22.0.0`), not merely a preference, so a host running Node 20 is reported
 * even though the client still functions there for now.
 */
function checkNodeVersion(): void {
  const major = Number(process.versions.node.split(".")[0]);
  if (Number.isFinite(major) && major < 22) {
    record(
      "node",
      false,
      `Node ${process.versions.node} — @supabase/supabase-js requires >=22.0.0. ` +
        "The client still runs on this version but prints a deprecation warning. " +
        "Set the hPanel Node version to 22.x to match engines.node and CI.",
    );
    return;
  }
  record("node", true, `Node ${process.versions.node}`);
}

function checkConfig(): boolean {
  const issues = getEnvIssues();
  const supabaseIssues = issues.filter((issue) => issue.variable.includes("SUPABASE"));

  if (supabaseIssues.length > 0) {
    record(
      "config",
      false,
      "the host delivered values that failed validation: " +
        supabaseIssues
          .map((issue) => `${issue.variable} (${issue.delivered ? "invalid" : "unset"})`)
          .join(", "),
    );
    return false;
  }

  const hasUrl = REQUIRED_URL.some((name) => Boolean(env[name as keyof typeof env]));
  const hasKey = REQUIRED_KEY.some((name) => Boolean(env[name as keyof typeof env]));

  if (!hasUrl || !hasKey) {
    record(
      "config",
      false,
      `both a URL and a key are required. Set ${REQUIRED_URL.join(" or ")} and ` +
        `${REQUIRED_KEY.join(" or ")}.`,
    );
    return false;
  }

  record(
    "config",
    true,
    `project ${env.SUPABASE_URL}; anon key ${tail(env.SUPABASE_ANON_KEY)}; ` +
      `service key ${tail(env.SUPABASE_SERVICE_ROLE_KEY)}`,
  );
  return true;
}

/**
 * Distinguishes "cannot reach the host" from "the host rejected the key" from
 * "the host answered". PostgREST answers the REST root with a 404 or 400 when
 * the key is valid, and 401/403 when it is not, so the status code alone is
 * enough to tell them apart.
 */
async function checkReachability(): Promise<"reach" | "auth" | null> {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(new URL("/rest/v1/", url), {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      record(
        "auth",
        false,
        `Supabase rejected the anon key with ${response.status}. Re-copy both ` +
          "SUPABASE_URL and SUPABASE_ANON_KEY from Supabase → Project Settings → API. " +
          "A key copied with surrounding whitespace is the usual cause.",
      );
      return "auth";
    }

    record("reach", true, `${url} answered ${response.status} (TLS + DNS + egress all OK)`);
    return "reach";
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? `no response within ${TIMEOUT_MS}ms`
        : error instanceof Error
          ? error.message
          : String(error);
    record(
      "reach",
      false,
      `${url} is unreachable from here (${reason}). Check that the URL is a real ` +
        "project host and that this environment allows outbound HTTPS.",
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** A real query through the app's own client — the thing that actually matters. */
async function checkData(table: string): Promise<void> {
  try {
    const supabase = getSupabaseAnonClient();
    const { error } = await supabase
      .from(table as "products")
      .select("id")
      .limit(1);

    if (error) {
      // A schema or RLS failure still proves the connection works, so it is
      // reported as a separate condition rather than a connection failure.
      const isPermission = error.code === "42501" || error.message?.includes("row-level security");
      record(
        "data",
        false,
        isPermission
          ? `connected, but the anon key may not read "${table}" (RLS denies it). This is a ` +
              "permissions problem, not a connection one — the request reached Supabase."
          : `query on "${table}" failed: ${error.message} (code ${error.code ?? "n/a"})`,
      );
      return;
    }

    record("data", true, `read from "${table}" through the app's anon client succeeded`);
  } catch (error) {
    record(
      "data",
      false,
      error instanceof Error ? error.message : "unknown error building the client",
    );
  }
}

async function main(): Promise<void> {
  const { table, json } = parseArgs(process.argv.slice(2));

  checkNodeVersion();

  if (!checkConfig()) {
    return finish(json);
  }

  const reach = await checkReachability();
  if (reach !== "reach") {
    // No point querying a table when the host or key already failed.
    return finish(json);
  }

  await checkData(table);
  finish(json);
}

function finish(json: boolean): void {
  // The Node check is advisory: it does not affect whether the app can reach
  // Supabase, so it must not flip the verdict. Only the connection stages do.
  const connectionStages: Stage[] = ["config", "reach", "auth", "data"];
  const evaluated = new Set(results.map((result) => result.stage));
  const missing = connectionStages.filter((stage) => !evaluated.has(stage));
  const connected =
    results
      .filter((result) => connectionStages.includes(result.stage))
      .every((result) => result.ok) && missing.length === 0;

  if (json) {
    console.log(JSON.stringify({ connected, skipped: missing, results }, null, 2));
  } else {
    console.log("");
    console.log("Supabase connection check");
    console.log("─────────────────────────");
    for (const stage of connectionStages) {
      const result = results.find((entry) => entry.stage === stage);
      if (result) {
        const mark = result.ok ? "✓" : "✗";
        console.log(`${mark} ${stage.padEnd(6)} ${result.detail}`);
      } else {
        console.log(`- ${stage.padEnd(6)} not evaluated — an earlier stage failed`);
      }
    }
    // Diagnostics that do not affect the verdict.
    for (const result of results) {
      if (!connectionStages.includes(result.stage)) {
        const mark = result.ok ? "✓" : "!";
        console.log(`${mark} ${result.stage.padEnd(6)} ${result.detail}`);
      }
    }
    console.log("");
    console.log(
      connected ? "RESULT: connected." : "RESULT: NOT connected — see the failing stage above.",
    );
    console.log("");
    console.log("What each stage means:");
    console.log("  config — a variable is unset or malformed in this environment.");
    console.log("  reach  — the project host is reachable (DNS, TLS, egress).");
    console.log("  auth   — Supabase accepted the key rather than rejecting it.");
    console.log("  data   — a real query through the app's own client succeeded.");
    console.log("");
    console.log("A `data` failure means the request DID reach Supabase, so the");
    console.log("connection is fine and the problem is RLS or schema instead.");
    console.log("");
  }

  process.exit(connected ? 0 : 1);
}

void main();
