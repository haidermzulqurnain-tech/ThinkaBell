import { describe, it, expect, vi, beforeEach } from "vitest";

type MockProducts = () => Promise<unknown[]>;
const mockRateLimit = vi.fn(() => Promise.resolve(true));
const mockGetComparableProducts = vi.fn<MockProducts>(() => Promise.resolve([]));
const mockGetBySlugs = vi.fn<MockProducts>(() => Promise.resolve([]));

vi.mock("@thinkabell/database", () => ({
  ComparisonRepository: {
    getComparableProducts: mockGetComparableProducts,
    getBySlugs: mockGetBySlugs,
  },
}));

vi.mock("@thinkabell/shared", () => ({
  rateLimit: mockRateLimit,
}));

describe("GET /api/compare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue(true);
  });

  it("should return 400 when neither category nor slugs is provided", async () => {
    const { GET } = await import("./route");
    const request = new Request("http://localhost:3000/api/compare");
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/category or slugs/);
  });

  it("should return 400 for an invalid category value", async () => {
    const { GET } = await import("./route");
    const request = new Request("http://localhost:3000/api/compare?category=services");
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(mockGetComparableProducts).not.toHaveBeenCalled();
  });

  it("should return 400 when slugs is empty after trimming", async () => {
    const { GET } = await import("./route");
    const request = new Request("http://localhost:3000/api/compare?slugs=,,");
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/at least one slug/);
    expect(mockGetBySlugs).not.toHaveBeenCalled();
  });

  it("should fetch comparable products by category", async () => {
    mockGetComparableProducts.mockResolvedValueOnce([{ slug: "a" }, { slug: "b" }]);
    const { GET } = await import("./route");
    const request = new Request("http://localhost:3000/api/compare?category=software");
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.products).toEqual([{ slug: "a" }, { slug: "b" }]);
    expect(mockGetComparableProducts).toHaveBeenCalledWith("software", 4);
  });

  it("should fetch products by slugs and cap at 20", async () => {
    mockGetBySlugs.mockResolvedValueOnce([{ slug: "a" }]);
    const { GET } = await import("./route");
    const slugs = Array.from({ length: 25 }, (_, i) => `slug-${i}`).join(",");
    const request = new Request(`http://localhost:3000/api/compare?slugs=${slugs}`);
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.products).toEqual([{ slug: "a" }]);
    expect(mockGetBySlugs).toHaveBeenCalledWith(Array.from({ length: 20 }, (_, i) => `slug-${i}`));
  });

  it("should enforce rate limiting", async () => {
    mockRateLimit.mockResolvedValueOnce(false);
    const { GET } = await import("./route");
    const request = new Request("http://localhost:3000/api/compare?category=software");
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toMatch(/Rate limit exceeded/);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(mockGetComparableProducts).not.toHaveBeenCalled();
  });

  it("should use IP-based rate limit key with fail-closed mode", async () => {
    const { GET } = await import("./route");
    const request = new Request("http://localhost:3000/api/compare?category=physical", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    await GET(request as any);

    expect(mockRateLimit).toHaveBeenCalledWith("compare:203.0.113.7", 30, 60, true);
  });

  it("should return 500 on unexpected error", async () => {
    mockGetComparableProducts.mockRejectedValueOnce(new Error("boom"));
    const { GET } = await import("./route");
    const request = new Request("http://localhost:3000/api/compare?category=physical");
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});
