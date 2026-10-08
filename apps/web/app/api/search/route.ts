import { NextResponse } from "next/server";
import { rateLimit } from "@thinkabell/shared";
import { searchProducts, normalizeCategory, CatalogQueryError } from "@/lib/catalog";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  category?: "physical" | "software";
  deal_type?: string;
  min_discount?: number;
  compatible_with?: string;
  cursor?: string;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() || undefined;
    const category = normalizeCategory(url.searchParams.get("category"));
    const dealType = url.searchParams.get("deal_type")?.trim() || undefined;
    const minDiscount = url.searchParams.get("min_discount");
    const compatibleWith = url.searchParams.get("compatible_with")?.trim() || undefined;
    const cursor = url.searchParams.get("cursor") || undefined;

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0]?.trim() : "unknown-ip";

    const allowed = await rateLimit(`search:${ip}`, 30, 60, true);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before retrying." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const params: SearchParams = {
      q,
      category,
      deal_type: dealType,
      min_discount: minDiscount ? Number(minDiscount) : undefined,
      compatible_with: compatibleWith,
      cursor,
    };

    const { count, results, nextCursor } = await searchProducts({
      q,
      category,
      min_discount: params.min_discount,
      cursor,
    });

    return NextResponse.json({
      query: params,
      count,
      results,
      nextCursor,
    });
  } catch (error) {
    if (error instanceof CatalogQueryError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.error("[Search] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
