import { NextResponse } from "next/server";
import { getEnvIssues } from "@thinkabell/config";
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
