import { NextRequest, NextResponse } from "next/server";
import { ComparisonRepository } from "@thinkabell/database";
import { rateLimit } from "@thinkabell/shared";

export const dynamic = "force-dynamic";

const MAX_SLUGS = 20;
const VALID_CATEGORIES = ["physical", "software"] as const;

type Category = (typeof VALID_CATEGORIES)[number];

function normalizeCategory(value: string | null): Category | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  return VALID_CATEGORIES.includes(lower as Category) ? (lower as Category) : null;
}

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

    if (rawSlugs) {
      const slugArray = rawSlugs.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_SLUGS);
      if (slugArray.length === 0) {
        return NextResponse.json({ error: "slugs query param must contain at least one slug" }, { status: 400 });
      }
      const products = await ComparisonRepository.getBySlugs(slugArray);
      return NextResponse.json({ products });
    }

    if (!category) {
      return NextResponse.json({ error: "category or slugs query param is required" }, { status: 400 });
    }

    const products = await ComparisonRepository.getComparableProducts(category, 4);
    return NextResponse.json({ products });
  } catch (error) {
    console.error("[Compare API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
