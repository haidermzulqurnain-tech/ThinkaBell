import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRateLimit = vi.fn(() => Promise.resolve(true));
const mockAnonymizeIp = vi.fn((ip: string) => ip);
const mockGenerateCsrfToken = vi.fn(() => "token-abc-123");
const mockResolveAmazonDestination = vi.fn(
  (url: string, _headers?: Headers, _origin?: string) => url,
);

vi.mock("@thinkabell/shared", () => ({
  rateLimit: mockRateLimit,
  anonymizeIp: mockAnonymizeIp,
  resolveAmazonDestination: mockResolveAmazonDestination,
}));

vi.mock("@/src/utils/csrf", () => ({
  generateCsrfToken: mockGenerateCsrfToken,
}));

const mockRpc = vi.fn();
let selectResult: { data: unknown; error: unknown } = { data: [], error: null };
let clickInsert: ReturnType<typeof vi.fn>;

function makeFrom(table: string) {
  if (table === "retailer_links") {
    const chain: Record<string, any> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.order = vi.fn(() => ({ then: (onFulfilled: any) => Promise.resolve(selectResult).then(onFulfilled) }));
    return chain;
  }
  if (table === "click_tracking") {
    clickInsert = vi.fn(() => Promise.resolve({ error: null }));
    return { insert: clickInsert };
  }
  throw new Error(`unexpected table ${table}`);
}

const mockFrom = vi.fn(makeFrom);

vi.mock("@thinkabell/database", () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom, rpc: mockRpc }),
}));

const mockLink = {
  id: 42,
  product_id: 10,
  retailer: "amazon",
  affiliate_url: "https://amazon.com/dp/B0TEST1234?tag=thinkabell-20",
  commission_rate: 4,
};

describe("GET /api/route-link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResult = { data: [mockLink], error: null };
    mockRateLimit.mockResolvedValue(true);
    mockResolveAmazonDestination.mockImplementation((url: string) => url);
  });

  it("should return 400 when product_id is missing", async () => {
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost:3000/api/route-link"));
    expect(response.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("should return 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValueOnce(false);
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost:3000/api/route-link?product_id=10"));
    expect(response.status).toBe(429);
  });

  it("should return 404 when no retailer links exist", async () => {
    selectResult = { data: [], error: null };
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost:3000/api/route-link?product_id=10"));
    expect(response.status).toBe(404);
  });

  it("should record every click with an attribution token and set the tb_click cookie", async () => {
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost:3000/api/route-link?product_id=10", {
      headers: { "x-forwarded-for": "203.0.113.7", "user-agent": "test-agent" },
    });
    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://amazon.com/dp/B0TEST1234?tag=thinkabell-20",
    );

    // Click row must be inserted even without a known subscriber.
    expect(mockFrom).toHaveBeenCalledWith("click_tracking");
    const inserted = clickInsert!.mock.calls[0]![0] as Record<string, unknown>;
    expect(inserted.retailer_link_id).toBe(42);
    expect(inserted.attribution_token).toBe("token-abc-123");
    expect(inserted.ip_address).toBe("203.0.113.7");
    expect(inserted.user_agent).toBe("test-agent");
    expect(inserted.subscriber_id).toBeUndefined();

    expect(mockRpc).toHaveBeenCalledWith("increment_retailer_click", { link_id: 42 });

    // Cookie must carry the same token for later attribution.
    const setCookie = response.headers.get("set-cookie") || "";
    expect(setCookie).toContain("tb_click=token-abc-123");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/");
  });

  it("should geo-route Amazon destinations through /go/amazon", async () => {
    mockResolveAmazonDestination.mockImplementationOnce(
      (url: string, _headers?: Headers, _origin?: string) =>
        `${_origin ?? "http://localhost:3000"}/go/amazon/B0TEST1234`,
    );
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost:3000/api/route-link?product_id=10", {
      headers: { "x-forwarded-for": "203.0.113.7", "user-agent": "test-agent" },
    });
    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/go/amazon/B0TEST1234",
    );
    // Click tracking and attribution still run for geo-routed clicks.
    expect(mockFrom).toHaveBeenCalledWith("click_tracking");
    expect(mockRpc).toHaveBeenCalledWith("increment_retailer_click", { link_id: 42 });
  });

  it("should return 500 when the retailer link query fails", async () => {
    selectResult = { data: null, error: { message: "db error" } };
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost:3000/api/route-link?product_id=10"));
    expect(response.status).toBe(500);
  });
});
