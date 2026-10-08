import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockConfig: Record<string, unknown> = {
  AMAZON_PARTNER_TAG: "thinkabell-us-20",
  AMAZON_PARTNER_TAG_UK: "thinkabell-uk-21",
  AMAZON_PARTNER_TAG_DE: "thinkabell-de-21",
  AMAZON_PARTNER_TAG_CA: "thinkabell-ca-20",
  AMAZON_LIST_URLS: "",
  AMAZON_LIST_MARKETPLACE: "US",
  AMAZON_LIST_MAX_ITEMS: 100,
  AMAZON_LIST_FETCH_DELAY_MS: 0,
};

vi.mock("@thinkabell/config", () => ({
  env: mockConfig,
}));

const LIST_HTML = `
<html><body>
  <div id="list-item-1" data-asin="B08N5WRWNW" class="a-section">
    <img src="https://m.media-amazon.com/images/I/51headphones.jpg" alt="Wireless Headphones" />
    <span class="a-truncate-full">Wireless Headphones</span>
    <span class="a-price"><span class="a-offscreen">$49.99</span></span>
  </div>
  <div id="list-item-2" data-asin="B07PGL2ZSN" class="a-section">
    <span class="a-truncate-full">Bluetooth Speaker</span>
    <span class="a-price"><span class="a-offscreen">£29.99</span></span>
  </div>
  <div id="list-item-3" data-asin="B08N5WRWNW" class="a-section">
    <span class="a-truncate-full">Wireless Headphones (duplicate)</span>
  </div>
  <div id="list-item-4" data-asin="B09XYZ1234" class="a-section">
    <span class="a-truncate-full">No Price Item</span>
  </div>
</body></html>
`;

describe("AmazonListClient", () => {
  describe("parseAmazonListHtml", () => {
    it("extracts ASIN, title, price and image from list markup", async () => {
      const { parseAmazonListHtml } = await import("./amazonListClient");
      const items = parseAmazonListHtml(LIST_HTML);

      expect(items).toHaveLength(3);
      expect(items[0]).toMatchObject({
        asin: "B08N5WRWNW",
        title: "Wireless Headphones",
        price: 49.99,
        imageUrl: "https://m.media-amazon.com/images/I/51headphones.jpg",
      });
      expect(items[1]).toMatchObject({
        asin: "B07PGL2ZSN",
        title: "Bluetooth Speaker",
        price: 29.99,
      });
    });

    it("deduplicates items by ASIN", async () => {
      const { parseAmazonListHtml } = await import("./amazonListClient");
      const items = parseAmazonListHtml(LIST_HTML);
      const asins = items.map((item) => item.asin);

      expect(new Set(asins).size).toBe(asins.length);
      expect(asins.filter((asin) => asin === "B08N5WRWNW")).toHaveLength(1);
    });

    it("handles items without a price", async () => {
      const { parseAmazonListHtml } = await import("./amazonListClient");
      const items = parseAmazonListHtml(LIST_HTML);
      const noPrice = items.find((item) => item.asin === "B09XYZ1234");

      expect(noPrice).toBeDefined();
      expect(noPrice!.price).toBeNull();
    });

    it("falls back to the image alt text for the title", async () => {
      const { parseAmazonListHtml } = await import("./amazonListClient");
      const html = '<div data-asin="B07TEST001"><img alt="Alt Title Product" /></div>';
      const items = parseAmazonListHtml(html);

      expect(items).toHaveLength(1);
      expect(items[0]!.title).toBe("Alt Title Product");
    });

    it("decodes HTML entities in titles", async () => {
      const { parseAmazonListHtml } = await import("./amazonListClient");
      const html =
        '<div data-asin="B07TEST002"><span class="a-truncate-full">Best &amp; Greatest</span></div>';
      const items = parseAmazonListHtml(html);

      expect(items[0]!.title).toBe("Best & Greatest");
    });

    it("returns an empty list for unknown page layouts", async () => {
      const { parseAmazonListHtml } = await import("./amazonListClient");
      expect(parseAmazonListHtml("<html><body>No products here</body></html>")).toEqual(
        [],
      );
    });

    it("skips items without a detectable title", async () => {
      const { parseAmazonListHtml } = await import("./amazonListClient");
      const html = '<div data-asin="B07TEST003"><span>No title markup</span></div>';
      expect(parseAmazonListHtml(html)).toEqual([]);
    });
  });

  describe("getAmazonListConfigs", () => {
    it("returns an empty array when unset", async () => {
      mockConfig.AMAZON_LIST_URLS = "";
      const { getAmazonListConfigs } = await import("./amazonListClient");
      expect(getAmazonListConfigs()).toEqual([]);
    });

    it("parses a JSON array of list URLs", async () => {
      mockConfig.AMAZON_LIST_URLS = JSON.stringify([
        { url: "https://www.amazon.com/hz/wishlist/ls/ABC123", marketplace: "US" },
        { url: "https://www.amazon.co.uk/hz/wishlist/ls/DEF456" },
      ]);
      const { getAmazonListConfigs } = await import("./amazonListClient");
      const configs = getAmazonListConfigs();

      expect(configs).toHaveLength(2);
      expect(configs[0]).toEqual({
        url: "https://www.amazon.com/hz/wishlist/ls/ABC123",
        marketplace: "US",
      });
      // Falls back to the configured default marketplace.
      expect(configs[1]!.marketplace).toBe("US");
    });

    it("normalizes GB marketplaces to UK", async () => {
      mockConfig.AMAZON_LIST_URLS = JSON.stringify([
        { url: "https://www.amazon.co.uk/hz/wishlist/ls/GBLIST", marketplace: "GB" },
      ]);
      const { getAmazonListConfigs } = await import("./amazonListClient");
      expect(getAmazonListConfigs()[0]!.marketplace).toBe("UK");
    });

    it("throws on malformed JSON", async () => {
      mockConfig.AMAZON_LIST_URLS = "{not-json";
      const { getAmazonListConfigs, AmazonListConfigError } = await import(
        "./amazonListClient"
      );

      expect(() => getAmazonListConfigs()).toThrow(AmazonListConfigError);
    });

    it("throws when the value is not an array", async () => {
      mockConfig.AMAZON_LIST_URLS = JSON.stringify({ url: "https://example.com" });
      const { getAmazonListConfigs, AmazonListConfigError } = await import(
        "./amazonListClient"
      );

      expect(() => getAmazonListConfigs()).toThrow(AmazonListConfigError);
    });

    it("drops entries without a URL", async () => {
      mockConfig.AMAZON_LIST_URLS = JSON.stringify([
        { marketplace: "US" },
        "not-an-object",
        { url: "https://www.amazon.com/hz/wishlist/ls/VALID" },
      ]);
      const { getAmazonListConfigs } = await import("./amazonListClient");
      const configs = getAmazonListConfigs();

      expect(configs).toHaveLength(1);
      expect(configs[0]!.url).toBe("https://www.amazon.com/hz/wishlist/ls/VALID");
    });
  });

  describe("AmazonListClient.fetchListItems", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchMock = vi.fn().mockResolvedValue(new Response(LIST_HTML));
      vi.stubGlobal("fetch", fetchMock);
      mockConfig.AMAZON_LIST_MAX_ITEMS = 100;
      mockConfig.AMAZON_PARTNER_TAG = "thinkabell-us-20";
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("harvests list items as DiscoveredProducts with affiliate links", async () => {
      const { AmazonListClient } = await import("./amazonListClient");
      const client = new AmazonListClient();
      const products = await client.fetchListItems({
        url: "https://www.amazon.com/hz/wishlist/ls/ABC123",
        marketplace: "US",
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(products).toHaveLength(3);
      expect(products[0]).toMatchObject({
        sourceId: "B08N5WRWNW",
        source: "amazon-list",
        name: "Wireless Headphones",
        price: 49.99,
        currency: "USD",
        url: "https://amazon.com/dp/B08N5WRWNW",
        affiliateUrl:
          "https://amazon.com/dp/B08N5WRWNW?tag=thinkabell-us-20&linkCode=osi&th=1&psc=1",
      });
      expect(products[0]!.metadata).toMatchObject({
        marketplace: "US",
        listUrl: "https://www.amazon.com/hz/wishlist/ls/ABC123",
        affiliateTagConfigured: true,
      });
    });

    it("uses the list marketplace currency", async () => {
      mockConfig.AMAZON_PARTNER_TAG_UK = "thinkabell-uk-21";
      const { AmazonListClient } = await import("./amazonListClient");
      const client = new AmazonListClient();
      const products = await client.fetchListItems({
        url: "https://www.amazon.co.uk/hz/wishlist/ls/DEF456",
        marketplace: "UK",
      });

      expect(products[1]!.currency).toBe("GBP");
      expect(products[1]!.affiliateUrl).toContain("amazon.co.uk");
      expect(products[1]!.affiliateUrl).toContain("tag=thinkabell-uk-21");
    });

    it("caps the harvested items at the configured maximum", async () => {
      mockConfig.AMAZON_LIST_MAX_ITEMS = 2;
      const { AmazonListClient } = await import("./amazonListClient");
      const client = new AmazonListClient();
      const products = await client.fetchListItems({
        url: "https://www.amazon.com/hz/wishlist/ls/ABC123",
        marketplace: "US",
      });

      expect(products).toHaveLength(2);
    });

    it("fails closed on affiliate links when the tag is unconfigured", async () => {
      mockConfig.AMAZON_PARTNER_TAG = "";
      const { AmazonListClient } = await import("./amazonListClient");
      const client = new AmazonListClient();
      const products = await client.fetchListItems({
        url: "https://www.amazon.com/hz/wishlist/ls/ABC123",
        marketplace: "US",
      });

      // Product is still harvested with its plain URL; no untagged
      // or placeholder affiliate link is emitted.
      expect(products[0]!.affiliateUrl).toBeUndefined();
      expect(products[0]!.url).toBe("https://amazon.com/dp/B08N5WRWNW");
      expect(products[0]!.metadata).toMatchObject({
        affiliateTagConfigured: false,
      });
    });

    it("propagates fetch failures", async () => {
      const httpError = Object.assign(new Error("HTTP 404"), { status: 404 });
      fetchMock.mockRejectedValue(httpError);
      const { AmazonListClient } = await import("./amazonListClient");
      const client = new AmazonListClient();

      await expect(
        client.fetchListItems({
          url: "https://www.amazon.com/hz/wishlist/ls/ABC123",
          marketplace: "US",
        }),
      ).rejects.toThrow("HTTP 404");
    });
  });
});
