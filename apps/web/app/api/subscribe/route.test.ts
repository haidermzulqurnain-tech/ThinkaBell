import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

type UpsertCall = { object: Record<string, unknown>; options: Record<string, unknown> };
let upsertCalls: UpsertCall[] = [];

function createSubscribeChain() {
  const single = vi.fn(() => ({ data: { id: 1 }, error: null }));
  const select = vi.fn(() => ({ single }));
  const upsert = vi.fn((object: Record<string, unknown>, options: Record<string, unknown>) => {
    upsertCalls.push({ object, options });
    return { select };
  });
  return { upsert, select, single };
}

const mockRateLimit = vi.fn(() => Promise.resolve(true));
const mockComputeBlindIndex = vi.fn((email: string) => `hash:${email.toLowerCase().trim()}`);
const mockEncryptField = vi.fn(async (value: string | null | undefined, _key?: string | null) =>
  value ? `enc:${value}` : null,
);
const mockGetEncryptionKey = vi.fn(() => "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff");

const mockClickUpdate = vi.fn();
const mockClickEq = vi.fn();
mockClickUpdate.mockReturnValue({ eq: mockClickEq });
mockClickEq.mockReturnValue({
  then: (onFulfilled: any) => Promise.resolve({ error: null }).then(onFulfilled),
});

const mockAnonFrom = vi.fn(() => createSubscribeChain());

vi.mock("@thinkabell/database", () => ({
  getSupabaseAnonClient: () => ({ from: mockAnonFrom }),
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table !== "click_tracking") throw new Error(`unexpected table ${table}`);
      return { update: mockClickUpdate };
    },
  }),
}));

vi.mock("@thinkabell/shared", () => ({
  rateLimit: mockRateLimit,
  computeBlindIndex: mockComputeBlindIndex,
  encryptField: mockEncryptField,
  getEncryptionKey: mockGetEncryptionKey,
}));

vi.mock("@/src/utils/csrf", () => ({
  validateCsrfToken: vi.fn(async () => true),
}));

function post(payload: unknown, cookie?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers["cookie"] = cookie;
  return new NextRequest("http://localhost:3000/api/subscribe", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

describe("POST /api/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertCalls = [];
    mockRateLimit.mockResolvedValue(true);
    mockGetEncryptionKey.mockReturnValue("00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff");
    mockEncryptField.mockImplementation(async (value: string | null | undefined) =>
      value ? `enc:${value}` : null,
    );
  });

  it("should upsert with blind index and encrypted PII", async () => {
    const { POST } = await import("./route");
    const response = await POST(post({ email: "  User@Example.COM ", push_subscription_id: "push-1" }) as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // Response echoes the normalized plaintext, never the ciphertext.
    expect(data.data.email).toBe("user@example.com");

    expect(upsertCalls).toHaveLength(1);
    const { object, options } = upsertCalls[0]!;
    expect(object).toEqual({
      email: "enc:user@example.com",
      email_hash: "hash:user@example.com",
      push_subscription_id: "enc:push-1",
      preferences: { categories: ["physical", "software"], min_discount: 10 },
    });
    expect(options).toEqual({ onConflict: "email_hash" });
    expect(mockComputeBlindIndex).toHaveBeenCalledWith("user@example.com");
  });

  it("should store null push token when none provided", async () => {
    const { POST } = await import("./route");
    const response = await POST(post({ email: "user@example.com" }) as any);

    expect(response.status).toBe(200);
    expect(upsertCalls[0]!.object).toMatchObject({ push_subscription_id: null });
  });

  it("should return 400 for an invalid email", async () => {
    const { POST } = await import("./route");
    const response = await POST(post({ email: "not-an-email" }) as any);
    expect(response.status).toBe(400);
    expect(upsertCalls).toHaveLength(0);
  });

  it("should return 400 for a malformed JSON body", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost:3000/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const response = await POST(request as any);
    expect(response.status).toBe(400);
  });

  it("should return 403 when CSRF validation fails", async () => {
    const { validateCsrfToken } = await import("@/src/utils/csrf");
    (validateCsrfToken as any).mockResolvedValueOnce(false);

    const { POST } = await import("./route");
    const response = await POST(post({ email: "user@example.com" }) as any);
    expect(response.status).toBe(403);
  });

  it("should return 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValueOnce(false);

    const { POST } = await import("./route");
    const response = await POST(post({ email: "user@example.com" }) as any);
    expect(response.status).toBe(429);
    expect(upsertCalls).toHaveLength(0);
  });

  it("should return 500 when the database upsert fails", async () => {
    (mockAnonFrom as any).mockReturnValueOnce({
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: { message: "db error" } })),
        })),
      })),
    });

    const { POST } = await import("./route");
    const response = await POST(post({ email: "user@example.com" }) as any);
    expect(response.status).toBe(500);
  });

  it("should not attribute any click when the tb_click cookie is absent", async () => {
    const { POST } = await import("./route");
    await POST(post({ email: "user@example.com" }) as any);

    expect(mockClickUpdate).not.toHaveBeenCalled();
  });

  it("should attribute the tb_click cookie's click to the new subscriber", async () => {
    const { POST } = await import("./route");
    const response = await POST(post({ email: "user@example.com" }, "tb_click=token-xyz") as any);

    expect(response.status).toBe(200);
    expect(mockClickUpdate).toHaveBeenCalledWith({ subscriber_id: 1 });
    expect(mockClickEq).toHaveBeenCalledWith("attribution_token", "token-xyz");
  });

  it("should still subscribe when click attribution fails", async () => {
    mockClickUpdate.mockImplementation(() => {
      throw new Error("attribution db error");
    });

    const { POST } = await import("./route");
    const response = await POST(post({ email: "user@example.com" }, "tb_click=token-xyz") as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
