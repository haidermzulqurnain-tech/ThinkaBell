import { NextResponse } from "next/server";
import { getCredentialAliasesUsed, getEnvIssues } from "@thinkabell/config";
import { getSupabaseAnonClient } from "@thinkabell/database";
import { redis } from "@thinkabell/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, string> = {};
  let isHealthy = true;

  // 0. Report environment variables the host delivered that failed validation.
  //    Names only — a health endpoint is unauthenticated, so values are never
  //    returned. This is the fastest way to see why Supabase is inert.
  const envIssues = getEnvIssues();
  checks.config =
    envIssues.length === 0
      ? "ok"
      : `rejected (defaults applied): ${envIssues.map((issue) => issue.variable).join(", ")}`;

  // A credential set under a non-canonical name is resolved by getEnv(), so the
  // app works — but the operator should see which name is actually in use,
  // because it differs from the documented one and from .env.example.
  const aliases = getCredentialAliasesUsed();
  if (aliases.length > 0) {
    const detail = aliases.map((entry) => `${entry.alias}→${entry.canonical}`).join(", ");
    checks.config =
      checks.config === "ok"
        ? `ok, via non-canonical name(s): ${detail}`
        : `${checks.config}; via non-canonical name(s): ${detail}`;
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
