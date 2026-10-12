import { describe, it, expect, vi, beforeEach } from "vitest";

interface SponsoredRetailer {
  retailer: string;
  affiliate_url: string;
}

function makeSponsoredChain(result: SponsoredRetailer[] | null) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            then: vi.fn((onFulfilled: (value: unknown) => unknown) =>
              Promise.resolve({ data: result, error: null }).then(onFulfilled),
            ),
          })),
        })),
      })),
      then: vi.fn((onFulfilled: (value: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      ),
    })),
  };
}

const mockSupabase = {
  from: vi.fn(() =>
    makeSponsoredChain([{ retailer: "amazon", affiliate_url: "https://amazon.com/dp/test" }]),
  ),
  rpc: vi.fn(),
};

vi.mock("@thinkabell/database", () => ({
  getSupabaseServiceClient: vi.fn(() => mockSupabase),
}));

describe("Sponsored Retailer API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/retailer-links/sponsored", () => {
    it("should return sponsored retailer for a product", async () => {
      mockSupabase.from.mockReturnValue(
        makeSponsoredChain([{ retailer: "amazon", affiliate_url: "https://amazon.com/dp/test" }]),
      );

      const { GET } = await import("./route");
      const request = new Request("http://localhost:3000/api/retailer-links/sponsored?productId=1");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.retailer).toBe("amazon");
    });

    it("should return null when no sponsored retailer found", async () => {
      mockSupabase.from.mockReturnValue(makeSponsoredChain(null));

      const { GET } = await import("./route");
      const request = new Request("http://localhost:3000/api/retailer-links/sponsored?productId=1");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.retailer).toBeNull();
    });

    it("should return 400 when productId is missing", async () => {
      const { GET } = await import("./route");
      const request = new Request("http://localhost:3000/api/retailer-links/sponsored");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("productId is required");
    });
  });
});
