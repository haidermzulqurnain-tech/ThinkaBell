import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const API_KEY = "test-alerts-key";
const mockRateLimit = vi.fn(() => Promise.resolve(true));
const mockComputeBlindIndex = vi.fn((email: string) => `hash:${email.toLowerCase().trim()}`);
const mockDecryptField = vi.fn(async (value: string | null | undefined) =>
  value ? value.replace(/^enc:/, "") : null,
);
const mockGetEncryptionKey = vi.fn(() => "key");

vi.mock("@thinkabell/shared", () => ({
  rateLimit: mockRateLimit,
  computeBlindIndex: mockComputeBlindIndex,
  decryptField: mockDecryptField,
  getEncryptionKey: mockGetEncryptionKey,
}));

interface Chain {
  [key: string]: any;
}

function makeFrom(subscriber: Record<string, unknown> | null, alerts: unknown[]) {
  const subscriberChain: Chain = {};
  subscriberChain.select = vi.fn(() => subscriberChain);
  subscriberChain.eq = vi.fn(() => subscriberChain);
  subscriberChain.maybeSingle = vi.fn(() => ({ data: subscriber, error: null }));

  const alertChain: Chain = {};
  alertChain.select = vi.fn(() => alertChain);
  alertChain.eq = vi.fn(() => alertChain);
  alertChain.order = vi.fn(() => alertChain);
  alertChain.limit = vi.fn(() => ({ then: (onFulfilled: any) => Promise.resolve({ data: alerts, error: null }).then(onFulfilled) }));

  const from = vi.fn((table: string) => {
    if (table === "subscribers") return subscriberChain;
    if (table === "alert_queue") return alertChain;
    throw new Error(`unexpected table ${table}`);
  });

  return { from, subscriberChain, alertChain };
}

let mockFrom: ReturnType<typeof vi.fn>;
let subscriberChain: Chain;
let alertChain: Chain;

function setup(subscriber: Record<string, unknown> | null, alerts: unknown[]) {
  const built = makeFrom(subscriber, alerts);
  mockFrom = built.from;
  subscriberChain = built.subscriberChain;
  alertChain = built.alertChain;
}

vi.mock("@thinkabell/database", () => ({
  getSupabaseServiceClient: () => ({ from: (...args: unknown[]) => mockFrom(...(args as [string])) }),
}));

function withApiKey(req: NextRequest): NextRequest {
  const headers = new Headers(req.headers);
  headers.set("authorization", `Bearer ${API_KEY}`);
  return new NextRequest(req.url, { headers });
}

describe("GET /api/alerts", () => {
  beforeEach(() => {
    process.env.ALERTS_API_KEY = API_KEY;
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue(true);
  });

  afterEach(() => {
    delete process.env.ALERTS_API_KEY;
  });

  it("should return 401 without an API key", async () => {
    setup(null, []);
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost:3000/api/alerts?email=user@example.com"));
    expect(response.status).toBe(401);
  });

  it("should return 401 for a wrong API key", async () => {
    setup(null, []);
    const { GET } = await import("./route");
    const headers = new Headers();
    headers.set("authorization", "Bearer wrong-key");
    const response = await GET(new NextRequest("http://localhost:3000/api/alerts?email=user@example.com", { headers }));
    expect(response.status).toBe(401);
  });

  it("should return 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValueOnce(false);
    setup(null, []);
    const { GET } = await import("./route");
    const response = await GET(withApiKey(new NextRequest("http://localhost:3000/api/alerts?email=user@example.com")));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toMatch(/Rate limit exceeded/);
  });

  it("should return 400 without an email param", async () => {
    setup(null, []);
    const { GET } = await import("./route");
    const response = await GET(withApiKey(new NextRequest("http://localhost:3000/api/alerts")));
    expect(response.status).toBe(400);
  });

  it("should return 404 when no subscriber matches the blind index", async () => {
    setup(null, []);
    const { GET } = await import("./route");
    const response = await GET(withApiKey(new NextRequest("http://localhost:3000/api/alerts?email=ghost@example.com")));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.found).toBe(false);
    expect(subscriberChain.eq).toHaveBeenCalledWith("email_hash", "hash:ghost@example.com");
  });

  it("should return the subscriber with decrypted PII and recent alerts", async () => {
    const subscriber = {
      id: 7,
      email: "enc:user@example.com",
      push_subscription_id: "enc:push-7",
      preferences: { categories: ["software"], min_discount: 20 },
      is_active: true,
    };
    const alerts = [{ id: 1, product_id: 10, subscriber_id: 7, sent: false }];
    setup(subscriber, alerts);

    const { GET } = await import("./route");
    const response = await GET(withApiKey(new NextRequest("http://localhost:3000/api/alerts?email=User@Example.COM")));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.found).toBe(true);
    // PII must be decrypted before leaving the route.
    expect(body.subscriber.email).toBe("user@example.com");
    expect(body.subscriber.push_subscription_id).toBe("push-7");
    expect(mockDecryptField).toHaveBeenCalledWith("enc:user@example.com", "key");
    expect(body.alerts).toEqual(alerts);
    expect(alertChain.eq).toHaveBeenCalledWith("subscriber_id", 7);
  });
});

describe("PATCH /api/alerts", () => {
  beforeEach(() => {
    process.env.ALERTS_API_KEY = API_KEY;
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue(true);
  });

  afterEach(() => {
    delete process.env.ALERTS_API_KEY;
  });

  function patch(payload: unknown, apiKeyOverride?: string) {
    const headers = new Headers();
    headers.set("content-type", "application/json");
    headers.set("authorization", `Bearer ${apiKeyOverride ?? API_KEY}`);
    return new NextRequest("http://localhost:3000/api/alerts", {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    });
  }

  it("should return 401 without an API key", async () => {
    setup(null, []);
    const { PATCH } = await import("./route");
    const response = await PATCH(patch({ email: "user@example.com", preferences: {} }, ""));
    expect(response.status).toBe(401);
  });

  it("should return 400 when email is missing from the body", async () => {
    setup(null, []);
    const { PATCH } = await import("./route");
    const response = await PATCH(patch({ preferences: {} }));
    expect(response.status).toBe(400);
  });

  it("should return 400 for invalid preferences", async () => {
    setup(null, []);
    const { PATCH } = await import("./route");
    const response = await PATCH(patch({ email: "user@example.com", preferences: { min_discount: 999 } }));
    expect(response.status).toBe(400);
  });

  it("should update preferences by blind index and return decrypted email", async () => {
    const updatedRow = {
      id: 7,
      email: "enc:user@example.com",
      preferences: { categories: ["software"], min_discount: 25 },
      digest_frequency: "daily",
    };
    const chain: Chain = {};
    chain.update = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.select = vi.fn(() => chain);
    chain.single = vi.fn(() => ({ then: (onFulfilled: any) => Promise.resolve({ data: updatedRow, error: null }).then(onFulfilled) }));
    setup(updatedRow, []);
    mockFrom.mockReturnValue(chain);

    const { PATCH } = await import("./route");
    const response = await PATCH(
      patch({ email: "User@Example.COM", preferences: { min_discount: 25, digest_frequency: "daily" } }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.email).toBe("user@example.com");
    expect(body.data.preferences).toEqual({ categories: ["software"], min_discount: 25 });
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ digest_frequency: "daily" }));
    expect(chain.eq).toHaveBeenCalledWith("email_hash", "hash:user@example.com");
  });

  it("should return 500 when the update fails", async () => {
    const chain: Chain = {};
    chain.update = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.select = vi.fn(() => chain);
    chain.single = vi.fn(() => ({ then: (onFulfilled: any) => Promise.resolve({ data: null, error: { message: "db error" } }).then(onFulfilled) }));
    setup(null, []);
    mockFrom.mockReturnValue(chain);

    const { PATCH } = await import("./route");
    const response = await PATCH(patch({ email: "user@example.com", preferences: {} }));
    expect(response.status).toBe(500);
  });
});
