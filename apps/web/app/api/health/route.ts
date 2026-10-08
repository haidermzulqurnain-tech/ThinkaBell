import { NextResponse } from "next/server";
import { getSupabaseAnonClient } from "@thinkabell/database";
import { redis } from "@thinkabell/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, string> = {};
  let isHealthy = true;

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
