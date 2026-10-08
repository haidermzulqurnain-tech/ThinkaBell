import { describe, it, expect, vi } from "vitest";

const mockConfig: Record<string, unknown> = {
  AMAZON_PARTNER_TAG: "thinkabell-us-20",
  AMAZON_PARTNER_TAG_UK: "thinkabell-uk-21",
  AMAZON_PARTNER_TAG_DE: "thinkabell-de-21",
  AMAZON_PARTNER_TAG_CA: "thinkabell-ca-20",
  AMAZON_LIST_MARKETPLACE: "US",
  NEXT_PUBLIC_APP_URL: "https://thinkabell.click",
  EDGE_PROXY_TRUSTED: false,
};

vi.mock("@thinkabell/config", () => ({
  env: mockConfig,
}));

function headersOf(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("GeoRouter", () => {
  describe("resolveVisitorCountry", () => {
    it("prefers the platform geo header", async () => {
      const { resolveVisitorCountry } = await import("./georouter");
      const country = resolveVisitorCountry(
        headersOf({
          "x-vercel-ip-country": "DE",
          "x-thinkabell-country": "CA",
        }),
      );
      expect(country).toBe("DE");
    });

    it("ignores the edge-proxy header when the proxy is not trusted", async () => {
      const { resolveVisitorCountry } = await import("./georouter");
      mockConfig.EDGE_PROXY_TRUSTED = false;
      const country = resolveVisitorCountry(
        headersOf({ "x-thinkabell-country": "CA" }),
      );
      expect(country).toBeUndefined();
    });

    it("honors the edge-proxy header when the proxy is trusted", async () => {
      const { resolveVisitorCountry } = await import("./georouter");
      mockConfig.EDGE_PROXY_TRUSTED = true;
      const country = resolveVisitorCountry(
        headersOf({ "x-thinkabell-country": "ca" }),
      );
      expect(country).toBe("ca");
      mockConfig.EDGE_PROXY_TRUSTED = false;
    });

    it("returns undefined when no geo headers are present", async () => {
      const { resolveVisitorCountry } = await import("./georouter");
      expect(resolveVisitorCountry(headersOf({}))).toBeUndefined();
      expect(resolveVisitorCountry(undefined)).toBeUndefined();
    });
  });

  describe("extractAsinFromAmazonUrl", () => {
    it("extracts ASINs from supported Amazon URL formats", async () => {
      const { extractAsinFromAmazonUrl } = await import("./georouter");
      expect(
        extractAsinFromAmazonUrl(
          "https://amazon.com/dp/B08N5WRWNW?tag=thinkabell-us-20",
        ),
      ).toBe("B08N5WRWNW");
      expect(
        extractAsinFromAmazonUrl(
          "https://www.amazon.co.uk/gp/product/B07PGL2ZSN",
        ),
      ).toBe("B07PGL2ZSN");
      expect(
        extractAsinFromAmazonUrl("https://amazon.de/gp/aw/d/B09XYZ1234"),
      ).toBe("B09XYZ1234");
    });

    it("returns null for non-Amazon or ASIN-less URLs", async () => {
      const { extractAsinFromAmazonUrl } = await import("./georouter");
      expect(
        extractAsinFromAmazonUrl("https://www.ebay.com/itm/12345"),
      ).toBeNull();
      expect(extractAsinFromAmazonUrl("https://amazon.com/dp/")).toBeNull();
      expect(extractAsinFromAmazonUrl("not-a-url")).toBeNull();
      expect(extractAsinFromAmazonUrl("")).toBeNull();
    });
  });

  describe("buildAmazonCtaLink", () => {
    it("builds a geo-routed link from a valid ASIN", async () => {
      const { buildAmazonCtaLink } = await import("./georouter");
      const cta = buildAmazonCtaLink({
        asin: "b08n5wrwnw",
        headers: headersOf({ "x-vercel-ip-country": "DE" }),
      });
      expect(cta).toEqual({
        href: "/go/amazon/B08N5WRWNW",
        marketplace: "DE",
      });
    });

    it("extracts the ASIN from a stored affiliate URL", async () => {
      const { buildAmazonCtaLink } = await import("./georouter");
      const cta = buildAmazonCtaLink({
        affiliateUrl: "https://amazon.com/dp/B08N5WRWNW?tag=x",
      });
      expect(cta?.href).toBe("/go/amazon/B08N5WRWNW");
    });

    it("fails closed on malformed ASINs", async () => {
      const { buildAmazonCtaLink } = await import("./georouter");
      expect(buildAmazonCtaLink({ asin: "nope" })).toBeNull();
      expect(
        buildAmazonCtaLink({ affiliateUrl: "https://amazon.com/dp/zzz" }),
      ).toBeNull();
    });

    it("fails closed when the marketplace tag is unconfigured", async () => {
      mockConfig.AMAZON_PARTNER_TAG_DE = "";
      const { buildAmazonCtaLink } = await import("./georouter");
      const cta = buildAmazonCtaLink({
        asin: "B08N5WRWNW",
        headers: headersOf({ "x-vercel-ip-country": "DE" }),
      });
      expect(cta).toBeNull();
      mockConfig.AMAZON_PARTNER_TAG_DE = "thinkabell-de-21";
    });

    it("returns null when no ASIN can be resolved", async () => {
      const { buildAmazonCtaLink } = await import("./georouter");
      expect(buildAmazonCtaLink({})).toBeNull();
    });
  });

  describe("resolveAmazonDestination", () => {
    it("routes Amazon URLs through the geo endpoint", async () => {
      const { resolveAmazonDestination } = await import("./georouter");
      const destination = resolveAmazonDestination(
        "https://amazon.com/dp/B08N5WRWNW?tag=thinkabell-us-20",
        headersOf({ "x-vercel-ip-country": "GB" }),
      );
      expect(destination).toBe(
        "https://thinkabell.click/go/amazon/B08N5WRWNW",
      );
    });

    it("keeps non-Amazon URLs untouched", async () => {
      const { resolveAmazonDestination } = await import("./georouter");
      expect(
        resolveAmazonDestination("https://www.ebay.com/itm/123"),
      ).toBe("https://www.ebay.com/itm/123");
    });

    it("keeps the stored URL when the marketplace is unconfigured", async () => {
      mockConfig.AMAZON_PARTNER_TAG = "";
      const { resolveAmazonDestination } = await import("./georouter");
      const stored = "https://amazon.com/dp/B08N5WRWNW?tag=legacy";
      expect(resolveAmazonDestination(stored)).toBe(stored);
      mockConfig.AMAZON_PARTNER_TAG = "thinkabell-us-20";
    });

    it("keeps the stored URL when the ASIN cannot be extracted", async () => {
      const { resolveAmazonDestination } = await import("./georouter");
      expect(
        resolveAmazonDestination("https://amazon.com/gp/bestsellers"),
      ).toBe("https://amazon.com/gp/bestsellers");
    });
  });
});
