/**
 * @file apps/web/app/api/cron/product-discovery/route.test.ts
 * @description Tests for the product-discovery cron endpoint
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";

vi.mock("@thinkabell/jobs", () => ({
  runProductDiscovery: vi.fn(() =>
    Promise.resolve({ discovered: 0, sources: [], errors: [] }),
  ),
}));

vi.mock("@thinkabell/shared", () => ({
  rateLimit: vi.fn(() => Promise.resolve(true)),
}));

describe("POST /api/cron/product-discovery", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CRON_SECRET = "test-secret";
  });

  it("should reject requests without authorization header", async () => {
    const request = new Request("http://localhost/api/cron/product-discovery", {
      method: "POST",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should reject requests with invalid bearer token", async () => {
    const request = new Request("http://localhost/api/cron/product-discovery", {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should allow requests with valid bearer token", async () => {
    const request = new Request("http://localhost/api/cron/product-discovery", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.discovered).toBe(0);
    expect(Array.isArray(data.sources)).toBe(true);
    expect(Array.isArray(data.errors)).toBe(true);
  });

  it("should enforce rate limiting", async () => {
    const { rateLimit } = await import("@thinkabell/shared");
    (rateLimit as any).mockResolvedValue(false);

    const request = new Request("http://localhost/api/cron/product-discovery", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain("Rate limit exceeded");
  });
});
