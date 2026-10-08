import { describe, it, expect, vi } from "vitest";

const mockConfig: Record<string, string> = {
  AMAZON_PARTNER_TAG: "thinkabell-us-20",
  AMAZON_PARTNER_TAG_UK: "thinkabell-uk-21",
  AMAZON_PARTNER_TAG_DE: "thinkabell-de-21",
  AMAZON_PARTNER_TAG_CA: "thinkabell-ca-20",
  AMAZON_LIST_MARKETPLACE: "US",
};

vi.mock("@thinkabell/config", () => ({
  env: mockConfig,
}));

describe("AmazonAffiliateLinkGenerator", () => {
  describe("getAmazonMarketplaces", () => {
    it("builds the registry from env configuration", async () => {
      const { getAmazonMarketplaces } = await import("./amazonAffiliateLinkGenerator");
      const marketplaces = getAmazonMarketplaces();

      expect(marketplaces.US).toEqual({
        code: "US",
        domain: "amazon.com",
        partnerTag: "thinkabell-us-20",
      });
      expect(marketplaces.UK!.domain).toBe("amazon.co.uk");
      expect(marketplaces.UK!.partnerTag).toBe("thinkabell-uk-21");
      expect(marketplaces.DE!.domain).toBe("amazon.de");
      expect(marketplaces.DE!.partnerTag).toBe("thinkabell-de-21");
      expect(marketplaces.CA!.domain).toBe("amazon.ca");
      expect(marketplaces.CA!.partnerTag).toBe("thinkabell-ca-20");
    });
  });

  describe("normalizeMarketplaceCode", () => {
    it("normalizes GB to UK", async () => {
      const { normalizeMarketplaceCode } = await import("./amazonAffiliateLinkGenerator");
      expect(normalizeMarketplaceCode("GB")).toBe("UK");
      expect(normalizeMarketplaceCode("us")).toBe("US");
    });

    it("falls back to the configured default marketplace", async () => {
      const { normalizeMarketplaceCode } = await import("./amazonAffiliateLinkGenerator");
      expect(normalizeMarketplaceCode(undefined)).toBe("US");
    });
  });

  describe("resolveAmazonMarketplace", () => {
    it("resolves a configured marketplace", async () => {
      const { resolveAmazonMarketplace } = await import("./amazonAffiliateLinkGenerator");
      const marketplace = resolveAmazonMarketplace("DE");
      expect(marketplace.code).toBe("DE");
      expect(marketplace.partnerTag).toBe("thinkabell-de-21");
    });

    it("falls back to the US marketplace for unlisted countries", async () => {
      const { resolveAmazonMarketplace } = await import("./amazonAffiliateLinkGenerator");
      const marketplace = resolveAmazonMarketplace("FR");
      expect(marketplace.code).toBe("US");
    });

    it("fails closed when the marketplace tag is not configured", async () => {
      mockConfig.AMAZON_PARTNER_TAG_DE = "";
      const { resolveAmazonMarketplace, AmazonAffiliateLinkError } = await import(
        "./amazonAffiliateLinkGenerator"
      );

      expect(() => resolveAmazonMarketplace("DE")).toThrow(AmazonAffiliateLinkError);
      expect(() => resolveAmazonMarketplace("DE")).toThrow(
        /partner tag not configured for marketplace DE/,
      );
      mockConfig.AMAZON_PARTNER_TAG_DE = "thinkabell-de-21";
    });

    it("fails closed when the US fallback tag is not configured", async () => {
      mockConfig.AMAZON_PARTNER_TAG = "";
      const { resolveAmazonMarketplace, AmazonAffiliateLinkError } = await import(
        "./amazonAffiliateLinkGenerator"
      );

      expect(() => resolveAmazonMarketplace("FR")).toThrow(AmazonAffiliateLinkError);
      mockConfig.AMAZON_PARTNER_TAG = "thinkabell-us-20";
    });
  });

  describe("isValidAsin", () => {
    it("accepts 10-character alphanumeric ASINs", async () => {
      const { isValidAsin } = await import("./amazonAffiliateLinkGenerator");
      expect(isValidAsin("B08N5WRWNW")).toBe(true);
      expect(isValidAsin("b08n5wrwnw")).toBe(true);
    });

    it("rejects malformed ASINs", async () => {
      const { isValidAsin } = await import("./amazonAffiliateLinkGenerator");
      expect(isValidAsin("short")).toBe(false);
      expect(isValidAsin("B08N5WRWNW-extra")).toBe(false);
      expect(isValidAsin("")).toBe(false);
    });
  });

  describe("generateAmazonAffiliateLink", () => {
    it("generates a US affiliate link", async () => {
      const { generateAmazonAffiliateLink } = await import("./amazonAffiliateLinkGenerator");
      expect(generateAmazonAffiliateLink("B08N5WRWNW")).toBe(
        "https://amazon.com/dp/B08N5WRWNW?tag=thinkabell-us-20&linkCode=osi&th=1&psc=1",
      );
    });

    it("generates a UK affiliate link", async () => {
      const { generateAmazonAffiliateLink } = await import("./amazonAffiliateLinkGenerator");
      expect(generateAmazonAffiliateLink("B08N5WRWNW", "UK")).toBe(
        "https://amazon.co.uk/dp/B08N5WRWNW?tag=thinkabell-uk-21&linkCode=osi&th=1&psc=1",
      );
    });

    it("generates a CA affiliate link for the CA country code", async () => {
      const { generateAmazonAffiliateLink } = await import("./amazonAffiliateLinkGenerator");
      const link = generateAmazonAffiliateLink("B08N5WRWNW", "CA");
      expect(link).toContain("amazon.ca");
      expect(link).toContain("tag=thinkabell-ca-20");
    });

    it("throws on a malformed ASIN", async () => {
      const { generateAmazonAffiliateLink } = await import("./amazonAffiliateLinkGenerator");
      expect(() => generateAmazonAffiliateLink("not-an-asin")).toThrow(/Invalid Amazon ASIN/);
    });
  });

  describe("buildAmazonProductUrl", () => {
    it("builds a plain product URL without a tag", async () => {
      const { buildAmazonProductUrl } = await import("./amazonAffiliateLinkGenerator");
      expect(buildAmazonProductUrl("B08N5WRWNW", "DE")).toBe(
        "https://amazon.de/dp/B08N5WRWNW",
      );
    });

    it("throws on a malformed ASIN", async () => {
      const { buildAmazonProductUrl } = await import("./amazonAffiliateLinkGenerator");
      expect(() => buildAmazonProductUrl("zzz")).toThrow(/Invalid Amazon ASIN/);
    });
  });
});
