import { NextResponse } from "next/server";
import { runFetchPrices } from "@thinkabell/jobs";
import { rateLimit } from "@thinkabell/shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0]?.trim() : "unknown-ip";

    const allowed = await rateLimit(`cron:fetch-prices:${ip}`, 10, 60, true);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before retrying." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const result = await runFetchPrices();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Cron] Error running fetch-prices:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
