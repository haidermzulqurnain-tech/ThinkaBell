import { env } from "@thinkabell/config";

export interface IAffiliateNetworkClient {
  generateAmazonLink(asin: string, country?: string): string;
  generateEbayLink(epid: string): string;
  buildAffiliateUrl(baseUrl: string, network: "amazon" | "ebay" | "impact" | "cj" | "shareasale" | "direct", clickId?: string): string;
}

class AffiliateNetworkClient implements IAffiliateNetworkClient {
  generateAmazonLink(asin: string, country = "US"): string {
    const domainMap: Record<string, { domain: string; tag: string }> = {
      US: { domain: "amazon.com", tag: env.AMAZON_PARTNER_TAG || "thinkabell-20" },
      UK: { domain: "amazon.co.uk", tag: "thinkabell-uk-21" },
      DE: { domain: "amazon.de", tag: "thinkabell-de-21" },
      CA: { domain: "amazon.ca", tag: "thinkabell-ca-20" },
    };

    const target = domainMap[country.toUpperCase()] || domainMap["US"]!;
    return `https://${target.domain}/dp/${asin}?tag=${target.tag}&linkCode=osi&th=1&psc=1`;
  }

  generateEbayLink(epid: string): string {
    const campid = env.EBAY_AFFILIATE_CAMPAIGN_ID || "5338000000";
    return `https://www.ebay.com/itm/${encodeURIComponent(epid)}?campid=${campid}&customid=thinkabell`;
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
          url.searchParams.set("tag", env.AMAZON_PARTNER_TAG || "thinkabell-20");
          url.searchParams.set("ascsubtag", clickId);
          break;
        case "ebay":
          url.searchParams.set("campid", env.EBAY_AFFILIATE_CAMPAIGN_ID || "5338000000");
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
          url.searchParams.set("ref", "thinkabell");
          url.searchParams.set("utm_source", "thinkabell.click");
          url.searchParams.set("utm_medium", "deal_alert");
          url.searchParams.set("utm_campaign", clickId);
          break;
      }

      return url.toString();
    } catch {
      return baseUrl;
    }
  }
}

export const affiliateNetworkClient: IAffiliateNetworkClient = new AffiliateNetworkClient();
