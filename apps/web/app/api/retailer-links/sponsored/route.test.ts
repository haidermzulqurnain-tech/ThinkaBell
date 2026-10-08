import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            then: vi.fn((onFulfilled) =>
              Promise.resolve({ data: [{ retailer: "amazon", affiliate_url: "https://amazon.com/dp/test" }], error: null }).then(onFulfilled),
            ),
          })),
        })),
      })),
      then: vi.fn((onFulfilled) => Promise.resolve({ data: null, error: null }).then(onFulfilled)),
    })),
  })),
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
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                then: vi.fn((onFulfilled) =>
                  Promise.resolve({ data: [{ retailer: "amazon", affiliate_url: "https://amazon.com/dp/test" }], error: null }).then(onFulfilled),
                ),
              })),
            })),
          })),
        })),
      });

      const { GET } = await import("./route");
      const request = new Request("http://localhost:3000/api/retailer-links/sponsored?productId=1");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.retailer).toBe("amazon");
    });

    it("should return null when no sponsored retailer found", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                then: vi.fn((onFulfilled) =>
                  Promise.resolve({ data: null, error: null }).then(onFulfilled),
                ),
              })),
            })),
          })),
        })),
      });

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
