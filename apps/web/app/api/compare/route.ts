import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@thinkabell/shared";
import { getCompareProducts, normalizeCategory } from "@/lib/compare";

export const dynamic = "force-dynamic";

const MAX_SLUGS = 20;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = normalizeCategory(searchParams.get("category"));
    const rawSlugs = searchParams.get("slugs");

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-ip";
    const allowed = await rateLimit(`compare:${ip}`, 30, 60, true);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before retrying." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    // Validate the request contract (400) before fetching, so a bad
    // request is never answered with a misleading 200 + empty set.
    if (rawSlugs) {
      const hasValidSlug = rawSlugs.split(",").some((s) => s.trim());
      if (!hasValidSlug) {
        return NextResponse.json({ error: "slugs query param must contain at least one slug" }, { status: 400 });
      }
    } else if (!category) {
      return NextResponse.json({ error: "category or slugs query param is required" }, { status: 400 });
    }

    const products = await getCompareProducts({
      slugs: rawSlugs ?? undefined,
      category: searchParams.get("category") ?? undefined,
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error("[Compare API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
