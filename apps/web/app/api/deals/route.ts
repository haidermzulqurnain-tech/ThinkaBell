import { NextResponse } from "next/server";
import { rateLimit } from "@thinkabell/shared";
import { fetchDeals, normalizeCategory, CatalogQueryError } from "@/lib/catalog";

export const dynamic = "force-dynamic";

interface DealsParams {
  category?: "physical" | "software";
  deal_type?: string;
  min_discount?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "biggest_discount";
  cursor?: string;
  limit: number;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const category = normalizeCategory(url.searchParams.get("category"));
    const dealType = url.searchParams.get("deal_type")?.trim() || undefined;
    const minDiscount = url.searchParams.get("min_discount");
    const sort = url.searchParams.get("sort") as DealsParams["sort"] | undefined;
    const cursor = url.searchParams.get("cursor") || undefined;
    const rawLimit = Number(url.searchParams.get("limit") || 24);

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0]?.trim() : "unknown-ip";

    const allowed = await rateLimit(`deals:${ip}`, 60, 60, true);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before retrying." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 48) : 24;

    const params: DealsParams = {
      category,
      deal_type: dealType,
      min_discount: minDiscount ? Number(minDiscount) : undefined,
      sort: sort || "newest",
      cursor,
      limit,
    };

    const { count, results, nextCursor, hasMore } = await fetchDeals({
      category,
      deal_type: dealType,
      min_discount: params.min_discount,
      sort: params.sort,
      cursor,
      limit,
    });

    return NextResponse.json({
      query: params,
      count,
      results,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    if (error instanceof CatalogQueryError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.error("[Deals] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
