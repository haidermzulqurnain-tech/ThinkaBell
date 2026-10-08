import { NextResponse } from "next/server";
import { getSupabaseAnonClient } from "@thinkabell/database";
import { rateLimit } from "@thinkabell/shared";
import { encodeCursor, decodeCursor } from "@thinkabell/shared";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  category?: "physical" | "software";
  deal_type?: string;
  min_discount?: number;
  compatible_with?: string;
  cursor?: string;
}

function normalizeCategory(value: unknown): "physical" | "software" | undefined {
  if (typeof value !== "string") return undefined;
  const lower = value.toLowerCase();
  if (lower === "physical" || lower === "software") {
    return lower as "physical" | "software";
  }
  return undefined;
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

    const limit = 24;
    let query = getSupabaseAnonClient()
      .from("products")
      .select("id, name, slug, category, brand, current_price, previous_price, image_url, description, tags, price_updated_at")
      .eq("is_active", true);

    if (params.category) {
      query = query.eq("category", params.category);
    }

    if (params.min_discount && Number.isFinite(params.min_discount)) {
      query = query.gte("discount_percent", Number(params.min_discount));
    }

    if (params.q) {
      query = query.textSearch("search_vector", params.q, { type: "websearch" });
    }

    const decodedCursor = cursor ? decodeCursor(cursor) : null;
    if (decodedCursor?.id && decodedCursor?.created_at) {
      query = query.lt("price_updated_at", decodedCursor.created_at as string);
    }

    query = query.order("price_updated_at", { ascending: false }).limit(limit + 1);

    const { data, error } = await query;

    if (error) {
      console.error("[Search] Error querying products:", error);
      return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    const hasMore = (data ?? []).length > limit;
    const items = hasMore ? (data ?? []).slice(0, limit) : (data ?? []);
    const lastItem = items[items.length - 1];
    const nextCursor = lastItem ? encodeCursor({ id: lastItem.id, created_at: lastItem.price_updated_at }) : null;

    const results = items.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      category: product.category,
      brand: product.brand,
      current_price: product.current_price,
      previous_price: product.previous_price,
      discount_percent: product.previous_price && product.current_price ? Number((((product.previous_price - product.current_price) / product.previous_price) * 100).toFixed(2)) : 0,
      image_url: product.image_url,
      description: product.description,
      tags: product.tags,
      price_updated_at: product.price_updated_at,
    }));

    return NextResponse.json({
      query: params,
      count: results.length,
      results,
      nextCursor,
    });
  } catch (error) {
    console.error("[Search] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
