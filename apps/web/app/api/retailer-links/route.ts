import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAnonClient, getSupabaseServiceClient } from "@thinkabell/database";
import { rateLimit } from "@thinkabell/shared";
import { env } from "@thinkabell/config";
import type { RetailerType } from "@thinkabell/database";

export const dynamic = "force-dynamic";

const RETAILERS = ["amazon", "ebay", "walmart"] as const;

const createLinkSchema = z.object({
  productId: z.number().int().positive(),
  retailer: z.enum(RETAILERS),
  affiliateUrl: z
    .string()
    .url("affiliateUrl must be a valid URL")
    .refine(
      (url) => {
        const parsed = new URL(url);
        return parsed.protocol === "https:" && parsed.hostname.includes(".");
      },
      { message: "affiliateUrl must use https with a valid hostname" },
    ),
  isSponsored: z.boolean().optional(),
});

function getApiKey(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7);
  }
  return request.nextUrl.searchParams.get("api_key");
}

function clientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown-ip";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const productId = searchParams.get("productId");
    const retailer = searchParams.get("retailer");

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    // Least privilege: RLS grants anon read-only access to retailer_links,
    // so reads never need the service-role client.
    const supabase = getSupabaseAnonClient();
    let query = supabase.from("retailer_links").select("*").eq("product_id", Number(productId));

    if (retailer && (RETAILERS as readonly string[]).includes(retailer)) {
      query = query.eq("retailer", retailer as RetailerType);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("[RetailerLinks] Error fetching links:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Fail-closed admin auth: every request must present the bearer token.
    const apiKey = getApiKey(request);
    if (!apiKey || apiKey !== env.RETAILER_LINKS_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await rateLimit(`retailer-links:${clientIp(request)}`, 10, 60, true);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before retrying." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const validation = createLinkSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Validation failed" },
        { status: 400 },
      );
    }

    const { productId, retailer, affiliateUrl, isSponsored } = validation.data;

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("retailer_links")
      .upsert(
        {
          product_id: productId,
          retailer,
          affiliate_url: affiliateUrl,
          is_sponsored: isSponsored ?? false,
        },
        { onConflict: "product_id,retailer" },
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[RetailerLinks] Error creating link:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
