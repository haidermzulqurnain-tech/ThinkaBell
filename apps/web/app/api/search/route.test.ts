import { describe, it, expect, vi, beforeEach } from "vitest";

const mockProduct = {
  id: 1,
  name: "Test Product",
  slug: "test-product",
  category: "software" as const,
  brand: "TestBrand",
  current_price: 49.99,
  previous_price: 99.99,
  image_url: "https://example.com/image.jpg",
  description: "A test product",
  tags: ["test"],
  price_updated_at: new Date().toISOString(),
};

function buildSupabaseMock(overrides: any = {}) {
  const eqChain = {
    eq: vi.fn(() => eqChain),
    gte: vi.fn(() => ({
      textSearch: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(overrides)),
        })),
      })),
    })),
    textSearch: vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve(overrides)),
      })),
    })),
    order: vi.fn(() => ({
      limit: vi.fn(() => Promise.resolve(overrides)),
    })),
  };

  const selectChain = {
    eq: vi.fn(() => eqChain),
    order: vi.fn(() => ({
      limit: vi.fn(() => Promise.resolve(overrides)),
    })),
  };

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => selectChain),
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(overrides)),
        })),
      })),
    })),
  };
}

const { mockRateLimit, mockSupabase, mockEncodeCursor, mockDecodeCursor } = vi.hoisted(() => {
  const mockRateLimit = vi.fn(() => Promise.resolve(true));
  const mockSupabase = buildSupabaseMock();
  const mockEncodeCursor = vi.fn((params: any) => Buffer.from(JSON.stringify(params)).toString("base64url"));
  const mockDecodeCursor = vi.fn((cursor: string) => {
    try {
      return JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8"));
    } catch {
      return null;
    }
  });
  return { mockRateLimit, mockSupabase, mockEncodeCursor, mockDecodeCursor };
});

vi.mock("@thinkabell/shared", () => ({
  rateLimit: mockRateLimit,
  encodeCursor: mockEncodeCursor,
  decodeCursor: mockDecodeCursor,
}));

vi.mock("@thinkabell/database", () => ({
  getSupabaseAnonClient: vi.fn(() => mockSupabase),
  getSupabaseServiceClient: vi.fn(),
}));

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.resetModules();
    mockRateLimit.mockResolvedValue(true);
    Object.assign(mockSupabase, buildSupabaseMock());
  });

  it("should return empty results for empty query", async () => {
    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/search");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results).toEqual([]);
    expect(data.count).toBe(0);
  });

  it("should enforce rate limiting", async () => {
    mockRateLimit.mockResolvedValue(false);

    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/search?q=test");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain("Rate limit exceeded");
  });

  it("should filter by category", async () => {
    const mockData = [
      {
        ...mockProduct,
        category: "software",
        current_price: 49.99,
        previous_price: 99.99,
      },
    ];

    Object.assign(mockSupabase, buildSupabaseMock({ data: mockData, error: null }));

    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/search?category=software");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results.length).toBeGreaterThan(0);
  });

  it("should handle database errors gracefully", async () => {
    Object.assign(mockSupabase, buildSupabaseMock({ data: null, error: { message: "DB error" } }));

    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/search?q=test");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Search failed");
  });
});
