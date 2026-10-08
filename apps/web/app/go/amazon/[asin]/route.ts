import { NextRequest, NextResponse } from "next/server";
import {
  AmazonAffiliateLinkError,
  generateAmazonAffiliateLink,
  isValidAsin,
  resolveVisitorCountry,
} from "@thinkabell/shared";

/**
 * Origin-side geo-routed Amazon deal link.
 *
 * Mirrors the Cloudflare edge-worker contract
 * (`/go/amazon/:asin` in packages/edge-worker) so geo-personalized
 * affiliate redirects work on every deployment topology: at the
 * edge when the worker fronts the site, or on this origin when
 * deployed directly (e.g. Hostinger).
 *
 * Fail-closed semantics:
 *   - 400 for malformed ASINs
 *   - 503 when the visitor's marketplace has no partner tag
 *     configured (never redirects to an untagged link)
 *
 * Geo headers are only used to select a storefront, never for
 * authorization. The edge-proxy header is honored only when
 * EDGE_PROXY_TRUSTED is enabled.
 */

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { asin: string };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const asin = (params.asin ?? "").toUpperCase();

  if (!isValidAsin(asin)) {
    return NextResponse.json({ error: "Invalid Amazon ASIN" }, { status: 400 });
  }

  try {
    const affiliateUrl = generateAmazonAffiliateLink(
      asin,
      resolveVisitorCountry(request.headers),
    );
    return NextResponse.redirect(new URL(affiliateUrl), 302);
  } catch (error) {
    if (error instanceof AmazonAffiliateLinkError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("[EdgeGo] Failed to route Amazon link:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
