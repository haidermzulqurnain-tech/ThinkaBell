import { env } from "@thinkabell/config";
import {
  AmazonAffiliateLinkError,
  generateAmazonAffiliateLink,
} from "./amazonAffiliateLinkGenerator";

export interface IAffiliateNetworkClient {
  generateAmazonLink(asin: string, country?: string): string;
  generateEbayLink(epid: string): string;
  buildAffiliateUrl(baseUrl: string, network: "amazon" | "ebay" | "impact" | "cj" | "shareasale" | "direct", clickId?: string): string;
}

class AffiliateNetworkClient implements IAffiliateNetworkClient {
  generateAmazonLink(asin: string, country = "US"): string {
    // Delegates to the modular, env-driven link generator.
    // Fails closed when the marketplace's partner tag is not
    // configured — no hardcoded fallback tags.
    return generateAmazonAffiliateLink(asin, country);
  }

  generateEbayLink(epid: string): string {
    if (!env.EBAY_AFFILIATE_CAMPAIGN_ID) {
      throw new AmazonAffiliateLinkError(
        "eBay affiliate campaign ID is not configured",
      );
    }

    return `https://www.ebay.com/itm/${encodeURIComponent(epid)}?campid=${env.EBAY_AFFILIATE_CAMPAIGN_ID}&customid=${env.AFFILIATE_ATTRIBUTION_ID}`;
  }

  buildAffiliateUrl(
    baseUrl: string,
    network: "amazon" | "ebay" | "impact" | "cj" | "shareasale" | "direct",
    clickId = "organic",
  ): string {
    try {
      const url = new URL(baseUrl);

      switch (network) {
        case "amazon":
          if (!env.AMAZON_PARTNER_TAG) {
            throw new AmazonAffiliateLinkError(
              "Amazon partner tag is not configured",
            );
          }
          url.searchParams.set("tag", env.AMAZON_PARTNER_TAG);
          url.searchParams.set("ascsubtag", clickId);
          break;
        case "ebay":
          if (!env.EBAY_AFFILIATE_CAMPAIGN_ID) {
            throw new AmazonAffiliateLinkError(
              "eBay affiliate campaign ID is not configured",
            );
          }
          url.searchParams.set("campid", env.EBAY_AFFILIATE_CAMPAIGN_ID);
          url.searchParams.set("customid", clickId);
          break;
        case "impact":
          url.searchParams.set("subId1", clickId);
          break;
        case "cj":
          url.searchParams.set("sid", clickId);
          break;
        case "shareasale":
          url.searchParams.set("afftrack", clickId);
          break;
        case "direct":
        default:
          url.searchParams.set("ref", env.AFFILIATE_ATTRIBUTION_ID);
          url.searchParams.set("utm_source", new URL(env.NEXT_PUBLIC_APP_URL).hostname);
          url.searchParams.set("utm_medium", "deal_alert");
          url.searchParams.set("utm_campaign", clickId);
          break;
      }

      return url.toString();
    } catch (error) {
      if (error instanceof AmazonAffiliateLinkError) {
        // Fail closed: propagate configuration errors instead of
        // silently returning an unmodified, untagged URL.
        throw error;
      }
      return baseUrl;
    }
  }
}

export const affiliateNetworkClient: IAffiliateNetworkClient = new AffiliateNetworkClient();
