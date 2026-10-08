import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@thinkabell/database";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("retailer_links")
      .select("*")
      .eq("product_id", Number(productId))
      .eq("is_sponsored", true)
      .limit(1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const link = data?.[0];
    return NextResponse.json({ retailer: link?.retailer ?? null, affiliateUrl: link?.affiliate_url ?? null });
  } catch (error) {
    console.error("[RetailerLinks] Error fetching sponsored retailer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
