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

    it("falls back to the global partner tag when per-marketplace tag is empty", async () => {
      mockConfig.AMAZON_PARTNER_TAG_DE = "";
      const { resolveAmazonMarketplace } = await import("./amazonAffiliateLinkGenerator");

      const marketplace = resolveAmazonMarketplace("DE");
      expect(marketplace.code).toBe("DE");
      expect(marketplace.partnerTag).toBe("thinkabell-us-20"); // global tag
      mockConfig.AMAZON_PARTNER_TAG_DE = "thinkabell-de-21";
    });

    it("fails closed when both per-marketplace and global tags are empty", async () => {
      mockConfig.AMAZON_PARTNER_TAG_DE = "";
      mockConfig.AMAZON_PARTNER_TAG = "";
      const { resolveAmazonMarketplace, AmazonAffiliateLinkError } =
        await import("./amazonAffiliateLinkGenerator");

      expect(() => resolveAmazonMarketplace("DE")).toThrow(AmazonAffiliateLinkError);
      expect(() => resolveAmazonMarketplace("DE")).toThrow(
        /partner tag not configured for marketplace DE/,
      );
      mockConfig.AMAZON_PARTNER_TAG_DE = "thinkabell-de-21";
      mockConfig.AMAZON_PARTNER_TAG = "thinkabell-us-20";
    });

    it("fails closed when the US fallback tag is not configured", async () => {
      mockConfig.AMAZON_PARTNER_TAG = "";
      const { resolveAmazonMarketplace, AmazonAffiliateLinkError } =
        await import("./amazonAffiliateLinkGenerator");

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
      expect(buildAmazonProductUrl("B08N5WRWNW", "DE")).toBe("https://amazon.de/dp/B08N5WRWNW");
    });

    it("throws on a malformed ASIN", async () => {
      const { buildAmazonProductUrl } = await import("./amazonAffiliateLinkGenerator");
      expect(() => buildAmazonProductUrl("zzz")).toThrow(/Invalid Amazon ASIN/);
    });
  });

  describe("isValidBrowseNode", () => {
    it("accepts valid browse node IDs", async () => {
      const { isValidBrowseNode } = await import("./amazonAffiliateLinkGenerator");
      expect(isValidBrowseNode("214331835011")).toBe(true);
      expect(isValidBrowseNode("172465")).toBe(true);
    });

    it("rejects invalid browse node IDs", async () => {
      const { isValidBrowseNode } = await import("./amazonAffiliateLinkGenerator");
      expect(isValidBrowseNode("short")).toBe(false);
      expect(isValidBrowseNode("abc123")).toBe(false);
      expect(isValidBrowseNode("")).toBe(false);
    });
  });

  describe("generateAmazonNodeLink", () => {
    it("generates a US browse node affiliate link", async () => {
      const { generateAmazonNodeLink } = await import("./amazonAffiliateLinkGenerator");
      const link = generateAmazonNodeLink("214331835011");
      expect(link).toBe(
        "https://amazon.com/b?node=214331835011&linkCode=ll2&tag=thinkabell-us-20&language=en_US&ref_=as_li_ss_tl",
      );
    });

    it("generates a UK browse node affiliate link", async () => {
      const { generateAmazonNodeLink } = await import("./amazonAffiliateLinkGenerator");
      const link = generateAmazonNodeLink("560780", "UK");
      expect(link).toContain("amazon.co.uk");
      expect(link).toContain("node=560780");
      expect(link).toContain("tag=thinkabell-uk-21");
    });

    it("throws on a malformed browse node ID", async () => {
      const { generateAmazonNodeLink } = await import("./amazonAffiliateLinkGenerator");
      expect(() => generateAmazonNodeLink("not-a-node")).toThrow(/Invalid Amazon browse node/);
    });
  });

  describe("buildAmazonShortLink", () => {
    it("passes through a valid Amazon short link", async () => {
      const { buildAmazonShortLink } = await import("./amazonAffiliateLinkGenerator");
      const url = "https://amzn.to/4ysiqN9";
      expect(buildAmazonShortLink(url)).toBe(url);
    });

    it("rejects a non-Amazon short link", async () => {
      const { buildAmazonShortLink } = await import("./amazonAffiliateLinkGenerator");
      expect(() => buildAmazonShortLink("https://bit.ly/3xyz")).toThrow(/Not an Amazon short link/);
    });

    it("rejects an invalid short-link code", async () => {
      const { buildAmazonShortLink } = await import("./amazonAffiliateLinkGenerator");
      expect(() => buildAmazonShortLink("https://amzn.to/short")).toThrow(
        /Invalid Amazon short-link/,
      );
    });
  });
});
