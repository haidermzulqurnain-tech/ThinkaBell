/**
 * @file apps/web/app/api/cron/fetch-prices/route.test.ts
 * @description Tests for the fetch-prices cron endpoint
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";

vi.mock("@thinkabell/jobs", () => ({
  runFetchPrices: vi.fn(() => Promise.resolve({ updated: 0, alertsQueued: 0 })),
}));

vi.mock("@thinkabell/shared", () => ({
  rateLimit: vi.fn(() => Promise.resolve(true)),
}));

describe("POST /api/cron/fetch-prices", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CRON_SECRET = "test-secret";
  });

  it("should reject requests without authorization header", async () => {
    const request = new Request("http://localhost/api/cron/fetch-prices", {
      method: "POST",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should reject requests with invalid bearer token", async () => {
    const request = new Request("http://localhost/api/cron/fetch-prices", {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should allow requests with valid bearer token", async () => {
    const request = new Request("http://localhost/api/cron/fetch-prices", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.updated).toBe(0);
    expect(data.alertsQueued).toBe(0);
  });

  it("should enforce rate limiting", async () => {
    const { rateLimit } = await import("@thinkabell/shared");
    (rateLimit as any).mockResolvedValue(false);

    const request = new Request("http://localhost/api/cron/fetch-prices", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain("Rate limit exceeded");
  });
});
