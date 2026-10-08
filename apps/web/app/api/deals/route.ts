import { NextResponse } from "next/server";
import { getSupabaseAnonClient } from "@thinkabell/database";
import { rateLimit } from "@thinkabell/shared";
import { encodeCursor, decodeCursor } from "@thinkabell/shared";

export const dynamic = "force-dynamic";

interface DealsParams {
  category?: "physical" | "software";
  deal_type?: string;
  min_discount?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "biggest_discount";
  cursor?: string;
  limit: number;
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
    const category = normalizeCategory(url.searchParams.get("category"));
    const dealType = url.searchParams.get("deal_type")?.trim() || undefined;
    const minDiscount = url.searchParams.get("min_discount");
    const sort = url.searchParams.get("sort") as DealsParams["sort"] | undefined;
    const cursor = url.searchParams.get("cursor") || undefined;
    const rawLimit = Number(url.searchParams.get("limit") || 24);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 48) : 24;

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0]?.trim() : "unknown-ip";

    const allowed = await rateLimit(`deals:${ip}`, 60, 60, true);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before retrying." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const params: DealsParams = {
      category,
      deal_type: dealType,
      min_discount: minDiscount ? Number(minDiscount) : undefined,
      sort: sort || "newest",
      cursor,
      limit,
    };

    let query = getSupabaseAnonClient()
      .from("products")
      .select("id, name, slug, category, brand, current_price, previous_price, image_url, description, tags, price_updated_at, deal_type, promo_code, deal_end_date")
      .eq("is_active", true);

    if (params.category) {
      query = query.eq("category", params.category);
    }

    if (params.deal_type) {
      query = query.eq("deal_type", params.deal_type);
    }

    if (params.min_discount && Number.isFinite(params.min_discount) && params.min_discount > 0) {
      query = query.gte("discount_percent", params.min_discount);
    }

    switch (params.sort) {
      case "price_asc":
        query = query.order("current_price", { ascending: true });
        break;
      case "price_desc":
        query = query.order("current_price", { ascending: false });
        break;
      case "biggest_discount":
        query = query.order("discount_percent", { ascending: false });
        break;
      case "newest":
      default:
        query = query.order("price_updated_at", { ascending: false });
        break;
    }

    const decodedCursor = cursor ? decodeCursor(cursor) : null;
    if (decodedCursor?.id && decodedCursor?.created_at) {
      query = query.lt("price_updated_at", decodedCursor.created_at as string);
    }

    query = query.limit(params.limit + 1);

    const { data, error } = await query;

    if (error) {
      console.error("[Deals] Error querying products:", error);
      return NextResponse.json({ error: "Failed to fetch deals" }, { status: 500 });
    }

    const hasMore = (data ?? []).length > params.limit;
    const items = hasMore ? (data ?? []).slice(0, params.limit) : (data ?? []);
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
      deal_type: product.deal_type,
      promo_code: product.promo_code,
      deal_end_date: product.deal_end_date,
    }));

    return NextResponse.json({
      query: params,
      count: results.length,
      results,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("[Deals] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
