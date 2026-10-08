import { env } from "@thinkabell/config";

/**
 * Modular Amazon affiliate link generation.
 *
 * All partner tags are sourced from environment configuration. There are no
 * hardcoded fallback tags: when a marketplace's tag is not configured the
 * generator fails closed with an explicit error rather than emitting an
 * untagged or placeholder link.
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

/**
 * Builds the marketplace registry from environment configuration.
 * Marketplaces with an empty partner tag are considered unconfigured.
 */
export function getAmazonMarketplaces(): Record<string, AmazonMarketplace> {
  return {
    US: { code: "US", domain: "amazon.com", partnerTag: env.AMAZON_PARTNER_TAG },
    UK: { code: "UK", domain: "amazon.co.uk", partnerTag: env.AMAZON_PARTNER_TAG_UK },
    DE: { code: "DE", domain: "amazon.de", partnerTag: env.AMAZON_PARTNER_TAG_DE },
    CA: { code: "CA", domain: "amazon.ca", partnerTag: env.AMAZON_PARTNER_TAG_CA },
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
 * Generates an Amazon affiliate ( Associates) URL for an ASIN.
 *
 * @throws AmazonAffiliateLinkError when the ASIN is malformed or the
 *         marketplace's partner tag is not configured.
 */
export function generateAmazonAffiliateLink(asin: string, country?: string): string {
  if (!isValidAsin(asin)) {
    throw new AmazonAffiliateLinkError(`Invalid Amazon ASIN: ${asin}`);
  }

  const marketplace = resolveAmazonMarketplace(country);
  return buildAmazonAffiliateUrl(asin, marketplace);
}

/**
 * Builds the affiliate URL for a validated ASIN and configured marketplace.
 */
export function buildAmazonAffiliateUrl(asin: string, marketplace: AmazonMarketplace): string {
  return `https://${marketplace.domain}/dp/${asin}?tag=${marketplace.partnerTag}&linkCode=osi&th=1&psc=1`;
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
