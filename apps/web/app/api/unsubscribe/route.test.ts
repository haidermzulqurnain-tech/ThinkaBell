import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockComputeBlindIndex = vi.fn((email: string) => `hash:${email.toLowerCase().trim()}`);
vi.mock("@thinkabell/shared", () => ({
  computeBlindIndex: mockComputeBlindIndex,
}));

interface LookupChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}
interface EraseChain {
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  eq2: ReturnType<typeof vi.fn>;
}
interface ClickChain {
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
}

let lookupChain: LookupChain;
let eraseChain: EraseChain;
let clickChain: ClickChain;
let subscriberRow: { id: number; unsubscribe_token: string | null } | null;
let rowError: { message: string } | null;

const mockFrom = vi.fn((table: string) => {
  if (table === "subscribers") {
    return { select: lookupChain.select, update: eraseChain.update };
  }
  if (table === "click_tracking") {
    return { update: clickChain.update };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@thinkabell/database", () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}));

function setup(options: {
  row?: { id: number; unsubscribe_token: string | null } | null;
  rowError?: { message: string } | null;
}) {
  subscriberRow = options.row ?? null;
  rowError = options.rowError ?? null;

  lookupChain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(() => ({ data: subscriberRow, error: rowError })),
  };
  lookupChain.select.mockReturnValue({ eq: lookupChain.eq });
  lookupChain.eq.mockReturnValue({ maybeSingle: lookupChain.maybeSingle });

  eraseChain = {
    update: vi.fn(),
    eq: vi.fn(),
    eq2: vi.fn(),
  };
  eraseChain.update.mockReturnValue({ eq: eraseChain.eq });
  eraseChain.eq.mockReturnValue({ eq: eraseChain.eq2 });
  eraseChain.eq2.mockReturnValue({
    then: (onFulfilled: any) => Promise.resolve({ error: null }).then(onFulfilled),
  });

  clickChain = {
    update: vi.fn(),
    eq: vi.fn(),
  };
  clickChain.update.mockReturnValue({ eq: clickChain.eq });
  clickChain.eq.mockReturnValue({
    then: (onFulfilled: any) => Promise.resolve({ error: null }).then(onFulfilled),
  });
}

function get(params: string) {
  return new NextRequest(`http://localhost:3000/api/unsubscribe${params}`);
}

describe("GET /api/unsubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return 400 when email is missing", async () => {
    setup({ row: null });
    const { GET } = await import("./route");
    const response = await GET(get("?token=abc"));
    expect(response.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("should return 500 when the subscriber lookup fails", async () => {
    setup({ row: null, rowError: { message: "db error" } });
    const { GET } = await import("./route");
    const response = await GET(get("?email=user@example.com"));
    expect(response.status).toBe(500);
  });

  it("should return 400 when no subscriber matches the blind index", async () => {
    setup({ row: null });
    const { GET } = await import("./route");
    const response = await GET(get("?email=ghost@example.com"));

    expect(response.status).toBe(400);
    expect(lookupChain.eq).toHaveBeenCalledWith("email_hash", "hash:ghost@example.com");
    // No erasure or attribution changes may occur for an unknown row.
    expect(eraseChain.update).not.toHaveBeenCalled();
    expect(clickChain.update).not.toHaveBeenCalled();
  });

  it("should return 400 without token and mint a new unsubscribe token when none exists", async () => {
    setup({ row: { id: 5, unsubscribe_token: null } });
    const { GET } = await import("./route");
    const response = await GET(get("?email=User@Example.COM"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/Unsubscribe token required/);
    // A new token must have been generated for the blind-indexed row.
    expect(eraseChain.update).toHaveBeenCalledWith(expect.objectContaining({ unsubscribe_token: expect.any(String) }));
    expect(eraseChain.eq).toHaveBeenCalledWith("email_hash", "hash:user@example.com");
    expect(clickChain.update).not.toHaveBeenCalled();
  });

  it("should return 400 without token when a token already exists", async () => {
    setup({ row: { id: 5, unsubscribe_token: "existing-token" } });
    const { GET } = await import("./route");
    await GET(get("?email=user@example.com"));

    expect(eraseChain.update).not.toHaveBeenCalled();
  });

  it("should return 400 when the supplied token does not match", async () => {
    setup({ row: { id: 5, unsubscribe_token: "secret-token" } });
    const { GET } = await import("./route");
    const response = await GET(get("?email=user@example.com&token=wrong-token"));

    expect(response.status).toBe(400);
    expect(eraseChain.update).not.toHaveBeenCalled();
    expect(clickChain.update).not.toHaveBeenCalled();
  });

  it("should erase PII and break click attribution when the token matches", async () => {
    setup({ row: { id: 5, unsubscribe_token: "secret-token" } });
    const { GET } = await import("./route");
    const response = await GET(get("?email=user@example.com&token=secret-token"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/unsubscribe/confirmed");

    const payload = eraseChain.update.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.is_active).toBe(false);
    expect(payload.unsubscribed_at).toEqual(expect.any(String));
    expect(payload.email).toMatch(/^anonymized-.+@deleted\.local$/);
    // Erased row must get a NEW blind index for the anonymized email so the
    // original hash can no longer locate it.
    expect(payload.email_hash).toBe(`hash:${payload.email}`);
    expect(payload.preferences).toEqual({});
    expect(payload.push_subscription_id).toBeNull();
    expect(payload.unsubscribe_token).toEqual(expect.any(String));
    expect(payload.unsubscribe_token).not.toBe("secret-token");

    expect(eraseChain.eq).toHaveBeenCalledWith("email_hash", "hash:user@example.com");
    expect(eraseChain.eq2).toHaveBeenCalledWith("unsubscribe_token", "secret-token");

    // Click attribution rows must be detached from the erased subscriber.
    expect(clickChain.update).toHaveBeenCalledWith({ subscriber_id: null });
    expect(clickChain.eq).toHaveBeenCalledWith("subscriber_id", 5);
  });
});
