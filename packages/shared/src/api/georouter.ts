import { env } from "@thinkabell/config";
import {
  AmazonAffiliateLinkError,
  generateAmazonAffiliateLink,
  isValidAsin,
  normalizeMarketplaceCode,
  resolveAmazonMarketplace,
} from "./amazonAffiliateLinkGenerator";

/**
 * Modular edge geo-routing for Amazon affiliate links.
 *
 * The Cloudflare edge-worker serves `/go/amazon/:asin` at the edge
 * (see packages/edge-worker). The web app exposes the same contract
 * at the origin (`apps/web/app/go/amazon/[asin]`), so geo-routed
 * links work on every deployment topology: at the edge when the
 * worker fronts the site, or on the origin when deployed directly.
 *
 * Trust model — geo headers are only ever used to select a
 * storefront, never for authorization:
 *   1. `x-vercel-ip-country` — set by Vercel's edge when deployed
 *      on Vercel.
 *   2. `x-thinkabell-country` — injected by the edge-worker proxy;
 *      honored only when `EDGE_PROXY_TRUSTED` is enabled, since on
 *      direct deployments the header is client-controllable.
 *   3. Otherwise the configured default marketplace applies.
 */

/** Platform-set geo header (Vercel edge). */
export const GEO_HEADER_PLATFORM = "x-vercel-ip-country";
/** Edge-worker-injected geo header (trusted only via EDGE_PROXY_TRUSTED). */
export const GEO_HEADER_EDGE_PROXY = "x-thinkabell-country";
/** Path prefix for geo-routed Amazon deal links. */
export const EDGE_GO_PATH_PREFIX = "/go/amazon";

/**
 * Whether the upstream edge proxy is trusted to set geo headers.
 */
export function isEdgeProxyTrusted(): boolean {
  return env.EDGE_PROXY_TRUSTED === true;
}

/**
 * Resolves the visitor's country from trusted geo headers only.
 * Returns undefined when no trusted header is present.
 */
export function resolveVisitorCountry(
  headers: Headers | undefined,
): string | undefined {
  if (!headers) {
    return undefined;
  }

  const platform = headers.get(GEO_HEADER_PLATFORM)?.trim();
  if (platform) {
    return platform;
  }

  if (isEdgeProxyTrusted()) {
    const proxied = headers.get(GEO_HEADER_EDGE_PROXY)?.trim();
    if (proxied) {
      return proxied;
    }
  }

  return undefined;
}

/**
 * Extracts an ASIN from an Amazon product URL
 * (e.g. /dp/B08N5WRWNW, /gp/product/B08N5WRWNW).
 * Returns null for non-Amazon URLs or URLs without an ASIN.
 */
export function extractAsinFromAmazonUrl(url: string): string | null {
  if (!url) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!parsed.hostname.includes("amazon.")) {
    return null;
  }

  const match = parsed.pathname.match(
    /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i,
  );
  return match ? match[1]!.toUpperCase() : null;
}

export interface AmazonCtaInput {
  /** Known ASIN (e.g. `product.amazon_asin`). Takes precedence. */
  asin?: string | null;
  /** Stored affiliate URL to extract the ASIN from as a fallback. */
  affiliateUrl?: string | null;
  /** Request headers for geo resolution. */
  headers?: Headers;
}

export interface AmazonCtaResult {
  /** Same-origin geo-routed link, e.g. "/go/amazon/B08N5WRWNW". */
  href: string;
  /** Resolved marketplace code for the visitor. */
  marketplace: string;
}

/**
 * Builds a geo-routed Amazon CTA link for a product.
 *
 * Returns null (fail closed) when no valid ASIN can be resolved or
 * when the visitor's marketplace has no partner tag configured —
 * callers must fall back to the stored affiliate URL in that case.
 */
export function buildAmazonCtaLink(
  input: AmazonCtaInput,
): AmazonCtaResult | null {
  const asin =
    input.asin && isValidAsin(input.asin)
      ? input.asin.toUpperCase()
      : extractAsinFromAmazonUrl(String(input.affiliateUrl ?? ""));

  if (!asin) {
    return null;
  }

  try {
    const marketplace = resolveAmazonMarketplace(
      resolveVisitorCountry(input.headers),
    );
    return {
      href: `${EDGE_GO_PATH_PREFIX}/${asin}`,
      marketplace: marketplace.code,
    };
  } catch (error) {
    if (error instanceof AmazonAffiliateLinkError) {
      // Fail closed: the visitor's marketplace is not configured.
      return null;
    }
    throw error;
  }
}

/**
 * Resolves the geo-routed destination for a stored Amazon affiliate
 * URL. Returns the same-origin `/go/amazon/:asin` link when the
 * visitor's marketplace is fully configured, otherwise the original
 * URL (never breaks a working link).
 */
export function resolveAmazonDestination(
  affiliateUrl: string,
  headers?: Headers,
  origin?: string,
): string {
  const asin = extractAsinFromAmazonUrl(affiliateUrl);
  if (!asin) {
    return affiliateUrl;
  }

  try {
    resolveAmazonMarketplace(resolveVisitorCountry(headers));
  } catch (error) {
    if (error instanceof AmazonAffiliateLinkError) {
      return affiliateUrl;
    }
    throw error;
  }

  const base = origin ?? env.NEXT_PUBLIC_APP_URL;
  return `${base}${EDGE_GO_PATH_PREFIX}/${asin}`;
}
