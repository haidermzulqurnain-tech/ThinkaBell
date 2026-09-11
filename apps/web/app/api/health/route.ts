import { NextResponse } from "next/server";
import { supabase } from "@thinkabell/database";
import { redis } from "@thinkabell/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "ok";
  let cacheStatus = "ok";

  // 1. Check Supabase DB
  try {
    const { error } = await supabase.from("products").select("id").limit(1);
    if (error) {
      dbStatus = `degraded: ${error.message}`;
    }
  } catch (err) {
    dbStatus = `error: ${err instanceof Error ? err.message : "unreachable"}`;
  }

  // 2. Check Redis
  try {
    await redis.set("health-ping", "pong", { ex: 10 });
    const ping = await redis.get("health-ping");
    if (ping !== "pong") {
      cacheStatus = "degraded: ping mismatch";
    }
  } catch (err) {
    cacheStatus = `error: ${err instanceof Error ? err.message : "unreachable"}`;
  }

  const isHealthy = !dbStatus.startsWith("error");
  const responseTimeMs = Date.now() - startTime;

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      responseTimeMs,
      checks: {
        database: dbStatus,
        cache: cacheStatus,
      },
    },
    { status: isHealthy ? 200 : 503 },
  );
}
