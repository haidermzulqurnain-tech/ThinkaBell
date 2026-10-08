/**
 * @file packages/shared/src/api/affiliateNetworkClient.test.ts
 * @description Unit tests for Affiliate Network client
 */

import { afterEach, describe, it, expect, beforeEach, vi } from "vitest";

// Mock config
const mockConfig: Record<string, string> = {
  AMAZON_PARTNER_TAG: "thinkabell-20",
  AMAZON_PARTNER_TAG_UK: "thinkabell-uk-21",
  AMAZON_PARTNER_TAG_DE: "thinkabell-de-21",
  AMAZON_PARTNER_TAG_CA: "thinkabell-ca-20",
  EBAY_AFFILIATE_CAMPAIGN_ID: "5338000000",
  AFFILIATE_ATTRIBUTION_ID: "thinkabell",
  NEXT_PUBLIC_APP_URL: "https://thinkabell.click",
};
vi.mock("@thinkabell/config", () => ({
  env: mockConfig,
}));

const originalConfig = { ...mockConfig };

afterEach(() => {
  Object.assign(mockConfig, originalConfig);
});

describe("AffiliateNetworkClient", () => {
  describe("generateAmazonLink", () => {
    it("should generate US Amazon affiliate link by default", async () => {
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");
      const link = affiliateNetworkClient.generateAmazonLink("B0CM5N4G3T");

      expect(link).toBe(
        "https://amazon.com/dp/B0CM5N4G3T?tag=thinkabell-20&linkCode=osi&th=1&psc=1",
      );
    });

    it("should generate UK Amazon affiliate link", async () => {
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");
      const link = affiliateNetworkClient.generateAmazonLink("B0CM5N4G3T", "UK");

      expect(link).toContain("amazon.co.uk");
      expect(link).toContain("thinkabell-uk-21");
    });

    it("should generate DE Amazon affiliate link", async () => {
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");
      const link = affiliateNetworkClient.generateAmazonLink("B0CM5N4G3T", "DE");

      expect(link).toContain("amazon.de");
      expect(link).toContain("thinkabell-de-21");
    });

    it("should generate CA Amazon affiliate link", async () => {
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");
      const link = affiliateNetworkClient.generateAmazonLink("B0CM5N4G3T", "CA");

      expect(link).toContain("amazon.ca");
      expect(link).toContain("thinkabell-ca-20");
    });

    it("should fail closed when no partner tag is configured", async () => {
      mockConfig.AMAZON_PARTNER_TAG = "";
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");

      expect(() => affiliateNetworkClient.generateAmazonLink("B08N5WRWNW")).toThrow(
        /partner tag not configured/,
      );
    });

    it("should fail closed when the regional partner tag is missing", async () => {
      mockConfig.AMAZON_PARTNER_TAG_UK = "";
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");

      expect(() => affiliateNetworkClient.generateAmazonLink("B08N5WRWNW", "UK")).toThrow(
        /partner tag not configured for marketplace UK/,
      );
    });

    it("should throw on a malformed ASIN", async () => {
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");

      expect(() => affiliateNetworkClient.generateAmazonLink("not-an-asin")).toThrow(
        /Invalid Amazon ASIN/,
      );
    });

    it("should default to US for unknown country", async () => {
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");
      const link = affiliateNetworkClient.generateAmazonLink("B08N5WRWNW", "XX");

      expect(link).toContain("amazon.com");
      expect(link).toContain("thinkabell-20");
    });

    it("should be case-insensitive for country codes", async () => {
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");
      const link = affiliateNetworkClient.generateAmazonLink("B08N5WRWNW", "uk");

      expect(link).toContain("amazon.co.uk");
    });
  });

  describe("generateEbayLink", () => {
    it("should generate eBay affiliate link with campaign ID", async () => {
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");
      const link = affiliateNetworkClient.generateEbayLink("EPID-12345");

      expect(link).toContain("ebay.com/itm/EPID-12345");
      expect(link).toContain("campid=5338000000");
      expect(link).toContain("customid=thinkabell");
    });

    it("should fail closed when the campaign ID is not configured", async () => {
      mockConfig.EBAY_AFFILIATE_CAMPAIGN_ID = "";
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");

      expect(() => affiliateNetworkClient.generateEbayLink("EPID-TEST")).toThrow(
        /campaign ID is not configured/,
      );
      mockConfig.EBAY_AFFILIATE_CAMPAIGN_ID = "5338000000";
    });

    it("should encode item IDs in URL", async () => {
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");
      const link = affiliateNetworkClient.generateEbayLink("test item/123");

      expect(link).toContain("test%20item%2F123");
    });
  });

  describe("buildAffiliateUrl", () => {
    it("should add Amazon tag to URL", async () => {
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");
      const url = affiliateNetworkClient.buildAffiliateUrl(
        "https://example.com/product",
        "amazon",
        "click-123",
      );

      const parsed = new URL(url);
      expect(parsed.searchParams.get("tag")).toBe("thinkabell-20");
      expect(parsed.searchParams.get("ascsubtag")).toBe("click-123");
    });

    it("should add eBay campaign to URL", async () => {
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");
      const url = affiliateNetworkClient.buildAffiliateUrl(
        "https://example.com/item",
        "ebay",
      );

      const parsed = new URL(url);
      expect(parsed.searchParams.get("campid")).toBe("5338000000");
      expect(parsed.searchParams.get("customid")).toBe("organic");
    });

    it("should add Impact subId to URL", async () => {
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");
      const url = affiliateNetworkClient.buildAffiliateUrl(
        "https://example.com",
        "impact",
        "impact-click",
      );

      const parsed = new URL(url);
      expect(parsed.searchParams.get("subId1")).toBe("impact-click");
    });

    it("should add CJ sid to URL", async () => {
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");
      const url = affiliateNetworkClient.buildAffiliateUrl(
        "https://example.com",
        "cj",
      );

      const parsed = new URL(url);
      expect(parsed.searchParams.get("sid")).toBe("organic");
    });

    it("should add ShareASale afftrack to URL", async () => {
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");
      const url = affiliateNetworkClient.buildAffiliateUrl(
        "https://example.com",
        "shareasale",
        "sa-click",
      );

      const parsed = new URL(url);
      expect(parsed.searchParams.get("afftrack")).toBe("sa-click");
    });

    it("should add UTM params for direct network", async () => {
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");
      const url = affiliateNetworkClient.buildAffiliateUrl(
        "https://example.com",
        "direct",
        "summer-sale",
      );

      const parsed = new URL(url);
      expect(parsed.searchParams.get("ref")).toBe("thinkabell");
      expect(parsed.searchParams.get("utm_source")).toBe("thinkabell.click");
      expect(parsed.searchParams.get("utm_medium")).toBe("deal_alert");
      expect(parsed.searchParams.get("utm_campaign")).toBe("summer-sale");
    });

    it("should fail closed when the Amazon tag is not configured", async () => {
      mockConfig.AMAZON_PARTNER_TAG = "";
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");

      expect(() =>
        affiliateNetworkClient.buildAffiliateUrl(
          "https://example.com/product",
          "amazon",
        ),
      ).toThrow(/Amazon partner tag is not configured/);
      mockConfig.AMAZON_PARTNER_TAG = "thinkabell-20";
    });

    it("should fail closed when the eBay campaign ID is not configured", async () => {
      mockConfig.EBAY_AFFILIATE_CAMPAIGN_ID = "";
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");

      expect(() =>
        affiliateNetworkClient.buildAffiliateUrl(
          "https://example.com/item",
          "ebay",
        ),
      ).toThrow(/campaign ID is not configured/);
      mockConfig.EBAY_AFFILIATE_CAMPAIGN_ID = "5338000000";
    });

    it("should use organic as default clickId", async () => {
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");
      const url = affiliateNetworkClient.buildAffiliateUrl(
        "https://example.com",
        "amazon",
      );

      const parsed = new URL(url);
      expect(parsed.searchParams.get("ascsubtag")).toBe("organic");
    });

    it("should return original URL on parsing error", async () => {
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");
      const url = affiliateNetworkClient.buildAffiliateUrl(
        "not-a-valid-url",
        "amazon",
      );

      expect(url).toBe("not-a-valid-url");
    });

    it("should preserve existing URL params", async () => {
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");
      const url = affiliateNetworkClient.buildAffiliateUrl(
        "https://example.com/product?existing=param",
        "amazon",
      );

      const parsed = new URL(url);
      expect(parsed.searchParams.get("existing")).toBe("param");
      expect(parsed.searchParams.get("tag")).toBe("thinkabell-20");
    });
  });

  describe("IAffiliateNetworkClient interface", () => {
    it("should implement IAffiliateNetworkClient interface", async () => {
      const { affiliateNetworkClient } = await import("./affiliateNetworkClient");
      expect(typeof affiliateNetworkClient.generateAmazonLink).toBe("function");
      expect(typeof affiliateNetworkClient.generateEbayLink).toBe("function");
      expect(typeof affiliateNetworkClient.buildAffiliateUrl).toBe("function");
    });
  });
});