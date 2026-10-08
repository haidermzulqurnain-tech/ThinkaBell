import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const createChainableMock = () => {
  const chain: any = {};
  const methods = ["select", "eq", "in", "limit", "upsert", "single", "maybeSingle", "then"];
  for (const method of methods) {
    if (method === "then") {
      chain[method] = (onFulfilled: any) =>
        Promise.resolve({ data: [], error: null }).then(onFulfilled);
    } else if (method === "single" || method === "maybeSingle") {
      chain[method] = vi.fn(() =>
        Promise.resolve({ data: { id: 1 }, error: null }),
      );
    } else {
      chain[method] = vi.fn(() => chain);
    }
  }
  return chain;
};

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => createChainableMock()),
    upsert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() =>
          Promise.resolve({ data: { id: 1 }, error: null }),
        ),
      })),
    })),
  })),
  rpc: vi.fn(),
};

vi.mock("@thinkabell/database", () => ({
  getSupabaseAnonClient: vi.fn(() => mockSupabase),
  getSupabaseServiceClient: vi.fn(() => mockSupabase),
  RetailerLinkRepository: {
    getLinksForProduct: vi.fn(),
    upsertLink: vi.fn(),
    incrementClickCount: vi.fn(),
    getSponsoredLinksForProducts: vi.fn(),
  },
}));

vi.mock("@thinkabell/config", () => ({
  env: { RETAILER_LINKS_API_KEY: "test-admin-key" },
}));

describe("Retailer Links API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/retailer-links", () => {
    it("should return links for a product", async () => {
      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3000/api/retailer-links?productId=1");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it("should filter by retailer when provided", async () => {
      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3000/api/retailer-links?productId=1&retailer=amazon");
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("should return 400 when productId is missing", async () => {
      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3000/api/retailer-links");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("productId is required");
    });
  });

  describe("POST /api/retailer-links", () => {
    it("should create a new retailer link with a valid bearer token", async () => {
      const { POST } = await import("./route");
      const request = new NextRequest("http://localhost:3000/api/retailer-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-admin-key",
        },
        body: JSON.stringify({
          productId: 1,
          retailer: "amazon",
          affiliateUrl: "https://amazon.com/dp/test",
          isSponsored: false,
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("id");
    });

    it("should return 401 without a bearer token", async () => {
      const { POST } = await import("./route");
      const request = new NextRequest("http://localhost:3000/api/retailer-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: 1,
          retailer: "amazon",
          affiliateUrl: "https://amazon.com/dp/test",
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 401 with an invalid bearer token", async () => {
      const { POST } = await import("./route");
      const request = new NextRequest("http://localhost:3000/api/retailer-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer wrong-key",
        },
        body: JSON.stringify({
          productId: 1,
          retailer: "amazon",
          affiliateUrl: "https://amazon.com/dp/test",
        }),
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it("should return 400 when required fields are missing", async () => {
      const { POST } = await import("./route");
      const request = new NextRequest("http://localhost:3000/api/retailer-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-admin-key",
        },
        body: JSON.stringify({ productId: 1 }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
    });

    it("should return 400 for non-https affiliate URLs", async () => {
      const { POST } = await import("./route");
      const request = new NextRequest("http://localhost:3000/api/retailer-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-admin-key",
        },
        body: JSON.stringify({
          productId: 1,
          retailer: "amazon",
          affiliateUrl: "http://insecure.example.com/dp/test",
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("https");
    });

    it("should return 400 for an invalid retailer", async () => {
      const { POST } = await import("./route");
      const request = new NextRequest("http://localhost:3000/api/retailer-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-admin-key",
        },
        body: JSON.stringify({
          productId: 1,
          retailer: "unknown-retailer",
          affiliateUrl: "https://example.com/dp/test",
        }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});

