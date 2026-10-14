import { NextResponse } from "next/server";
import {
  getCredentialAliasesUsed,
  getEnvIssues,
  getUnsetFailClosedCredentials,
} from "@thinkabell/config";
import { getSupabaseAnonClient } from "@thinkabell/database";
import { redis } from "@thinkabell/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, string> = {};
  let isHealthy = true;

  // 0a. Variables the host delivered that failed validation. Names only — this
  //     endpoint is unauthenticated, so values are never returned — plus the
  //     reason, because "rejected" alone does not say whether to fix a value or
  //     a name. This is what makes a placeholder credential self-diagnosing.
  const envIssues = getEnvIssues();
  checks.config =
    envIssues.length === 0
      ? "ok"
      : `rejected: ${envIssues
          .map(
            (issue) =>
              `${issue.variable} (${issue.delivered ? "invalid value" : "unset"}: ${issue.reason})`,
          )
          .join("; ")}`;

  // 0b. Credentials resolved through a non-canonical name. getEnv() handles
  //     these, so the app works — but the operator should see which spelling is
  //     actually in use, since it differs from the documented one.
  const aliases = getCredentialAliasesUsed();
  if (aliases.length > 0) {
    const detail = aliases.map((entry) => `${entry.alias}→${entry.canonical}`).join(", ");
    checks.config =
      checks.config === "ok"
        ? `ok, via non-canonical name(s): ${detail}`
        : `${checks.config}; via non-canonical name(s): ${detail}`;
  }

  // 0c. Fail-closed credentials that are unset. These do not make the app
  //     unhealthy — it still answers — so `status` is deliberately unaffected;
  //     without this an operator reading only "healthy" cannot see that a
  //     revenue path or the PII encryption is dead. `credentials` is separate
  //     for exactly that reason, so alerting on status stays meaningful.
  const unset = getUnsetFailClosedCredentials();
  if (unset.length > 0) {
    const securityCount = unset.filter((entry) => entry.security).length;
    checks.credentials = `${unset.length} unset (${securityCount} security-critical): ${unset
      .map((entry) => entry.variable)
      .join(", ")}`;
  } else {
    checks.credentials = "ok";
  }

  // 1. Check Supabase DB
  try {
    const supabase = getSupabaseAnonClient();
    const { error } = await supabase.from("products").select("id").limit(1);
    if (error) {
      checks.database = `degraded: ${error.message}`;
      isHealthy = false;
    } else {
      checks.database = "ok";
    }
  } catch (err) {
    checks.database = `error: ${err instanceof Error ? err.message : "unreachable"}`;
    isHealthy = false;
  }

  // 2. Check Redis
  try {
    await redis.set("health-ping", "pong", { ex: 10 });
    const ping = await redis.get("health-ping");
    if (ping !== "pong") {
      checks.cache = "degraded: ping mismatch";
    } else {
      checks.cache = "ok";
    }
  } catch (err) {
    checks.cache = `error: ${err instanceof Error ? err.message : "unreachable"}`;
    isHealthy = false;
  }

  const responseTimeMs = Date.now() - startTime;

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      responseTimeMs,
      checks,
    },
    { status: isHealthy ? 200 : 503 },
  );
}
