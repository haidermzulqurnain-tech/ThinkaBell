import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@thinkabell/database";
import { rateLimit, anonymizeIp, resolveAmazonDestination } from "@thinkabell/shared";
import { generateCsrfToken } from "@/src/utils/csrf";

export const dynamic = "force-dynamic";

const ATTRIBUTION_COOKIE = "tb_click";
const ATTRIBUTION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function GET(request: NextRequest) {
  try {
    const productId = Number(request.nextUrl.searchParams.get("product_id"));
    if (!productId) {
      return NextResponse.json({ error: "product_id is required" }, { status: 400 });
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const rawIp = forwardedFor ? forwardedFor.split(",")[0]?.trim() : "unknown-ip";
    const ip = anonymizeIp(rawIp) || "unknown-ip";
    const allowed = await rateLimit(`route-link:${ip}`, 60, 60, true);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before retrying." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const supabase = getSupabaseServiceClient();
    const { data: links, error: linksError } = await supabase
      .from("retailer_links")
      .select("*")
      .eq("product_id", productId)
      .order("commission_rate", { ascending: false });

    if (linksError) {
      console.error("[RouteLink] Error fetching retailer links:", linksError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!links || links.length === 0) {
      return NextResponse.json({ error: "No retailer links found for this product." }, { status: 404 });
    }

    const best = links[0];
    if (!best) {
      return NextResponse.json({ error: "No retailer links found for this product." }, { status: 404 });
    }

    const affiliateUrl = best.affiliate_url;

    // Geo-route Amazon destinations through /go/amazon/:asin so the
    // visitor lands on their regional storefront with the regional
    // partner tag. Non-Amazon URLs (and Amazon URLs whose marketplace
    // is unconfigured) pass through unchanged — never break a
    // working link.
    const destination = resolveAmazonDestination(
      affiliateUrl,
      request.headers,
      request.nextUrl.origin,
    );

    // Every click is recorded with a unique attribution token. The token is
    // echoed back in the tb_click cookie so later events (e.g. /api/subscribe)
    // can attribute the click to a subscriber without PII in URLs.
    const attributionToken = generateCsrfToken();
    await supabase.from("click_tracking").insert({
      retailer_link_id: best.id,
      attribution_token: attributionToken,
      ip_address: ip,
      user_agent: request.headers.get("user-agent"),
    });

    await supabase.rpc("increment_retailer_click", { link_id: best.id });

    const response = NextResponse.redirect(new URL(destination, request.url), 302);
    response.cookies.set(ATTRIBUTION_COOKIE, attributionToken, {
      path: "/",
      maxAge: ATTRIBUTION_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
    });
    return response;
  } catch (error) {
    console.error("[RouteLink] Error routing link:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
