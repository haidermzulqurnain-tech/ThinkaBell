import { describe, it, expect, vi } from "vitest";

const mockConfig: Record<string, string> = {
  AMAZON_PARTNER_TAG: "thinkabell06-20",
  AMAZON_PARTNER_TAG_UK: "",
  AMAZON_PARTNER_TAG_DE: "",
  AMAZON_PARTNER_TAG_CA: "",
  AMAZON_LIST_MARKETPLACE: "US",
  AMAZON_CATEGORIES: "",
};

vi.mock("@thinkabell/config", () => ({
  env: mockConfig,
}));

describe("AmazonCategoryConfig", () => {
  describe("getAmazonCategories", () => {
    it("returns default categories when env is unset", async () => {
      const { getAmazonCategories } = await import("./amazonCategoryConfig");
      const categories = getAmazonCategories();

      expect(categories.length).toBeGreaterThan(0);
      const laptops = categories.find((c) => c.code === "laptops");
      expect(laptops).toBeDefined();
      expect(laptops!.type).toBe("physical");
      const usNode = laptops!.browseNodes.US;
      expect(usNode).toBeDefined();
      expect(usNode!.nodeId).toBeDefined();
    });

    it("returns enabled categories only", async () => {
      const { getEnabledAmazonCategories } = await import("./amazonCategoryConfig");
      const enabled = getEnabledAmazonCategories();

      expect(enabled.length).toBeGreaterThan(0);
      for (const cat of enabled) {
        expect(cat.enabled).toBe(true);
      }
    });

    it("parses custom categories from AMAZON_CATEGORIES env var", async () => {
      mockConfig.AMAZON_CATEGORIES = JSON.stringify([
        {
          code: "test-cat",
          name: "Test Category",
          type: "physical",
          browseNodes: {
            US: { nodeId: "12345678", label: "Test" },
          },
          queries: ["test query"],
          enabled: true,
        },
      ]);
      const { getAmazonCategories } = await import("./amazonCategoryConfig");
      const categories = getAmazonCategories();

      const testCat = categories.find((c) => c.code === "test-cat");
      expect(testCat).toBeDefined();
      const testUsNode = testCat!.browseNodes.US;
      expect(testUsNode).toBeDefined();
      expect(testUsNode!.nodeId).toBe("12345678");
      expect(testCat!.queries).toContain("test query");

      mockConfig.AMAZON_CATEGORIES = "";
    });

    it("throws on malformed AMAZON_CATEGORIES JSON", async () => {
      mockConfig.AMAZON_CATEGORIES = "not-json";
      const { getAmazonCategories } = await import("./amazonCategoryConfig");
      expect(() => getAmazonCategories()).toThrow(/AMAZON_CATEGORIES must be a JSON array/);
      mockConfig.AMAZON_CATEGORIES = "";
    });
  });

  describe("resolveCategoryBrowseNode", () => {
    it("resolves a category browse node for a marketplace", async () => {
      const { resolveCategoryBrowseNode } = await import("./amazonCategoryConfig");
      const node = resolveCategoryBrowseNode("laptops", "US");

      expect(node.nodeId).toBeDefined();
      expect(node.label).toBeDefined();
    });

    it("throws for unknown category", async () => {
      const { resolveCategoryBrowseNode } = await import("./amazonCategoryConfig");
      expect(() => resolveCategoryBrowseNode("nonexistent")).toThrow(/Unknown Amazon category/);
    });

    it("fails closed when no partner tag is configured", async () => {
      mockConfig.AMAZON_PARTNER_TAG = "";
      const { resolveCategoryBrowseNode } = await import("./amazonCategoryConfig");
      expect(() => resolveCategoryBrowseNode("laptops", "US")).toThrow(/partner tag/);
      mockConfig.AMAZON_PARTNER_TAG = "thinkabell06-20";
    });
  });

  describe("generateCategoryAffiliateLink", () => {
    it("generates a category browse node affiliate link", async () => {
      const { generateCategoryAffiliateLink } = await import("./amazonCategoryConfig");
      const link = generateCategoryAffiliateLink("laptops", "US");

      expect(link).toContain("amazon.com");
      expect(link).toContain("b?node=");
      expect(link).toContain("tag=thinkabell06-20");
      expect(link).toContain("linkCode=ll2");
    });

    it("throws when no partner tag is configured", async () => {
      mockConfig.AMAZON_PARTNER_TAG = "";
      const { generateCategoryAffiliateLink } = await import("./amazonCategoryConfig");
      expect(() => generateCategoryAffiliateLink("laptops", "US")).toThrow(/partner tag/);
      mockConfig.AMAZON_PARTNER_TAG = "thinkabell06-20";
    });
  });

  describe("generateCategoryUrl", () => {
    it("generates a plain category browse node URL", async () => {
      const { generateCategoryUrl } = await import("./amazonCategoryConfig");
      const url = generateCategoryUrl("laptops", "US");

      expect(url).toContain("amazon.com");
      expect(url).toContain("b?node=");
      expect(url).not.toContain("tag=");
    });
  });
});
