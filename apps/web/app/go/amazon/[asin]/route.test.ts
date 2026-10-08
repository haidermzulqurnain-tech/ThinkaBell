import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

class AmazonAffiliateLinkError extends Error {}

const mockGenerateAmazonAffiliateLink = vi.fn(
  (asin: string, country?: string) =>
    `https://amazon.com/dp/${asin}?tag=thinkabell-us-20${
      country ? `&geo=${country}` : ""
    }`,
);
const mockIsValidAsin = vi.fn((asin: string) => /^[A-Z0-9]{10}$/i.test(asin));
const mockResolveVisitorCountry = vi.fn((): string | undefined => undefined);

vi.mock("@thinkabell/shared", () => ({
  AmazonAffiliateLinkError,
  generateAmazonAffiliateLink: mockGenerateAmazonAffiliateLink,
  isValidAsin: mockIsValidAsin,
  resolveVisitorCountry: mockResolveVisitorCountry,
}));

function requestWith(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/go/amazon/B08N5WRWNW", {
    headers,
  });
}

describe("GET /go/amazon/[asin]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateAmazonAffiliateLink.mockImplementation(
      (asin: string, country?: string) =>
        `https://amazon.com/dp/${asin}?tag=thinkabell-us-20${
          country ? `&geo=${country}` : ""
        }`,
    );
    mockIsValidAsin.mockImplementation((asin: string) =>
      /^[A-Z0-9]{10}$/i.test(asin),
    );
    mockResolveVisitorCountry.mockImplementation(() => undefined);
  });

  it("redirects to the tagged affiliate URL by default", async () => {
    const { GET } = await import("./route");
    const response = await GET(requestWith(), { params: { asin: "B08N5WRWNW" } });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://amazon.com/dp/B08N5WRWNW?tag=thinkabell-us-20",
    );
  });

  it("resolves the visitor marketplace from the platform geo header", async () => {
    mockResolveVisitorCountry.mockReturnValueOnce("GB");
    mockGenerateAmazonAffiliateLink.mockReturnValueOnce(
      "https://amazon.co.uk/dp/B08N5WRWNW?tag=thinkabell-uk-21",
    );
    const { GET } = await import("./route");
    const response = await GET(requestWith({ "x-vercel-ip-country": "GB" }), {
      params: { asin: "B08N5WRWNW" },
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://amazon.co.uk/dp/B08N5WRWNW?tag=thinkabell-uk-21",
    );
  });

  it("normalizes lowercase ASINs", async () => {
    const { GET } = await import("./route");
    const response = await GET(requestWith(), { params: { asin: "b08n5wrwnw" } });

    expect(response.status).toBe(302);
    expect(mockGenerateAmazonAffiliateLink).toHaveBeenCalledWith(
      "B08N5WRWNW",
      undefined,
    );
  });

  it("returns 400 for malformed ASINs", async () => {
    const { GET } = await import("./route");
    const response = await GET(requestWith(), { params: { asin: "not-an-asin" } });

    expect(response.status).toBe(400);
    expect(mockGenerateAmazonAffiliateLink).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when the marketplace tag is unconfigured", async () => {
    const { GET } = await import("./route");
    mockGenerateAmazonAffiliateLink.mockImplementationOnce(() => {
      throw new AmazonAffiliateLinkError(
        "Amazon partner tag not configured for marketplace DE",
      );
    });
    mockResolveVisitorCountry.mockReturnValueOnce("DE");

    const response = await GET(requestWith({ "x-vercel-ip-country": "DE" }), {
      params: { asin: "B08N5WRWNW" },
    });

    expect(response.status).toBe(503);
  });

  it("returns 500 on unexpected errors", async () => {
    const { GET } = await import("./route");
    mockGenerateAmazonAffiliateLink.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const response = await GET(requestWith(), { params: { asin: "B08N5WRWNW" } });

    expect(response.status).toBe(500);
  });
});
