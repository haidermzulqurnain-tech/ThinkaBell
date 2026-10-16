import { env } from "@thinkabell/config";

/**
 * Modular Amazon affiliate link generation.
 *
 * All partner tags are sourced from environment configuration. There are no
 * hardcoded fallback tags: when a marketplace's tag is not configured the
 * generator fails closed with an explicit error rather than emitting an
 * untagged or placeholder link.
 *
 * Supported link types:
 *   - ASIN product links: https://amazon.com/dp/{asin}?tag={tag}&...
 *   - Browse node (category) links: https://amazon.com/b?node={node}&tag={tag}&...
 *   - Amazon short links (amzn.to): passthrough, validated by shape only
 */

export interface AmazonMarketplace {
  /** ISO-style marketplace code, e.g. "US", "UK", "DE", "CA". */
  code: string;
  /** Amazon storefront domain, e.g. "amazon.com". */
  domain: string;
  /** Associates partner tag for this marketplace. */
  partnerTag: string;
}

export class AmazonAffiliateLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmazonAffiliateLinkError";
  }
}

const ASIN_PATTERN = /^[A-Z0-9]{10}$/i;

/** Amazon short-link domain (amzn.to). */
const AMAZON_SHORT_DOMAIN = "amzn.to";

/** Valid browse node ID: 6-14 digits. */
const BROWSE_NODE_PATTERN = /^\d{6,14}$/;

/** Amazon short-link code: 7-11 alphanumeric characters. */
const AMAZON_SHORT_CODE_PATTERN = /^[A-Za-z0-9]{7,11}$/;

/**
 * Builds the marketplace registry from environment configuration.
 *
 * `AMAZON_PARTNER_TAG` is the primary tag (single store ID across all
 * marketplaces). Per-marketplace tags (`AMAZON_PARTNER_TAG_UK`, etc.) override
 * it for that marketplace only. Marketplaces with an empty resolved tag are
 * considered unconfigured.
 */
export function getAmazonMarketplaces(): Record<string, AmazonMarketplace> {
  const globalTag = env.AMAZON_PARTNER_TAG;
  return {
    US: { code: "US", domain: "amazon.com", partnerTag: globalTag },
    UK: {
      code: "UK",
      domain: "amazon.co.uk",
      partnerTag: env.AMAZON_PARTNER_TAG_UK || globalTag,
    },
    DE: {
      code: "DE",
      domain: "amazon.de",
      partnerTag: env.AMAZON_PARTNER_TAG_DE || globalTag,
    },
    CA: {
      code: "CA",
      domain: "amazon.ca",
      partnerTag: env.AMAZON_PARTNER_TAG_CA || globalTag,
    },
  };
}

/**
 * Normalizes a country/marketplace input to a supported marketplace code.
 * Accepts 2-letter country codes and common aliases (e.g. "GB" -> "UK").
 */
export function normalizeMarketplaceCode(input?: string): string {
  const code = (input || env.AMAZON_LIST_MARKETPLACE || "US").toUpperCase();
  if (code === "GB") {
    return "UK";
  }
  return code;
}

/**
 * Resolves the marketplace for a country code.
 * Unlisted countries fall back to the US marketplace.
 *
 * @throws AmazonAffiliateLinkError when the resolved marketplace has no
 *         partner tag configured (fail closed — never generate an
 *         untagged or placeholder affiliate link).
 */
export function resolveAmazonMarketplace(country?: string): AmazonMarketplace {
  const marketplaces = getAmazonMarketplaces();
  const code = normalizeMarketplaceCode(country);
  const marketplace = marketplaces[code] ?? marketplaces["US"]!;

  if (!marketplace.partnerTag) {
    throw new AmazonAffiliateLinkError(
      `Amazon partner tag not configured for marketplace ${marketplace.code}`,
    );
  }

  return marketplace;
}

/**
 * Validates an Amazon ASIN (10 alphanumeric characters).
 */
export function isValidAsin(asin: string): boolean {
  return ASIN_PATTERN.test(asin);
}

/**
 * Validates an Amazon browse node ID (8-14 digits).
 */
export function isValidBrowseNode(nodeId: string): boolean {
  return BROWSE_NODE_PATTERN.test(nodeId);
}

/**
 * Validates an Amazon short-link code (amzn.to/{code}).
 * Only shape-validated — the destination is not followed.
 */
export function isValidAmazonShortCode(code: string): boolean {
  return AMAZON_SHORT_CODE_PATTERN.test(code);
}

/**
 * Checks whether a URL is an Amazon short link (amzn.to).
 */
export function isAmazonShortLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === AMAZON_SHORT_DOMAIN;
  } catch {
    return false;
  }
}

/**
 * Generates an Amazon affiliate (Associates) URL for an ASIN.
 *
 * @throws AmazonAffiliateLinkError when the ASIN is malformed or the
 *         marketplace's partner tag is not configured.
 */
export function generateAmazonAffiliateLink(asin: string, country?: string): string {
  if (!isValidAsin(asin)) {
    throw new AmazonAffiliateLinkError(`Invalid Amazon ASIN: ${asin}`);
  }

  const marketplace = resolveAmazonMarketplace(country);
  return buildAmazonProductAffiliateUrl(asin, marketplace);
}

/**
 * Builds the affiliate URL for a validated ASIN and configured marketplace.
 */
export function buildAmazonProductAffiliateUrl(
  asin: string,
  marketplace: AmazonMarketplace,
): string {
  return `https://${marketplace.domain}/dp/${asin}?tag=${marketplace.partnerTag}&linkCode=osi&th=1&psc=1`;
}

/**
 * Generates an Amazon browse node (category) affiliate link.
 *
 * Browse nodes are Amazon category identifiers. A node link sends the visitor
 * to a category page with the affiliate tag attached, so qualifying purchases
 * made in that session are attributed.
 *
 * Template:
 *   https://amazon.com/b?node={nodeId}&linkCode=ll2&tag={tag}&language=en_US&ref_=as_li_ss_tl
 *
 * @throws AmazonAffiliateLinkError when the node ID is malformed or the
 *         marketplace's partner tag is not configured.
 */
export function generateAmazonNodeLink(nodeId: string, country?: string): string {
  if (!isValidBrowseNode(nodeId)) {
    throw new AmazonAffiliateLinkError(`Invalid Amazon browse node ID: ${nodeId}`);
  }

  const marketplace = resolveAmazonMarketplace(country);
  return buildAmazonNodeAffiliateUrl(nodeId, marketplace);
}

/**
 * Builds the browse node affiliate URL for a validated node ID and marketplace.
 */
export function buildAmazonNodeAffiliateUrl(
  nodeId: string,
  marketplace: AmazonMarketplace,
): string {
  return `https://${marketplace.domain}/b?node=${nodeId}&linkCode=ll2&tag=${marketplace.partnerTag}&language=en_US&ref_=as_li_ss_tl`;
}

/**
 * Passes through an Amazon short link after shape validation.
 *
 * Short links (amzn.to/{code}) are Amazon's own shortener. We cannot and do
 * not regenerate them — the code is Amazon-issued. This function validates the
 * shape and returns the URL unchanged.
 *
 * @throws AmazonAffiliateLinkError when the URL is not a valid Amazon short link.
 */
export function buildAmazonShortLink(url: string): string {
  if (!isAmazonShortLink(url)) {
    throw new AmazonAffiliateLinkError(`Not an Amazon short link: ${url} (expected amzn.to/...)`);
  }
  try {
    const parsed = new URL(url);
    const code = parsed.pathname.replace(/^\//, "");
    if (!isValidAmazonShortCode(code)) {
      throw new AmazonAffiliateLinkError(`Invalid Amazon short-link code: ${code}`);
    }
  } catch (error) {
    if (error instanceof AmazonAffiliateLinkError) throw error;
    throw new AmazonAffiliateLinkError(`Invalid Amazon short link: ${url}`);
  }
  return url;
}

/**
 * Builds a plain (non-affiliate) product URL for a validated ASIN.
 * Used when no partner tag is configured but the product URL is still needed.
 */
export function buildAmazonProductUrl(asin: string, country?: string): string {
  if (!isValidAsin(asin)) {
    throw new AmazonAffiliateLinkError(`Invalid Amazon ASIN: ${asin}`);
  }

  const marketplaces = getAmazonMarketplaces();
  const code = normalizeMarketplaceCode(country);
  const marketplace = marketplaces[code] ?? marketplaces["US"]!;
  return `https://${marketplace.domain}/dp/${asin}`;
}

/**
 * Builds a plain (non-affiliate) browse node URL for a validated node ID.
 */
export function buildAmazonNodeUrl(nodeId: string, country?: string): string {
  if (!isValidBrowseNode(nodeId)) {
    throw new AmazonAffiliateLinkError(`Invalid Amazon browse node ID: ${nodeId}`);
  }

  const marketplaces = getAmazonMarketplaces();
  const code = normalizeMarketplaceCode(country);
  const marketplace = marketplaces[code] ?? marketplaces["US"]!;
  return `https://${marketplace.domain}/b?node=${nodeId}&language=en_US`;
}
