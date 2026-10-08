/**
 * @file apps/web/app/api/cron/send-alerts/route.test.ts
 * @description Tests for the send-alerts cron endpoint
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";

vi.mock("@thinkabell/jobs", () => ({
  runSendAlerts: vi.fn(() => Promise.resolve({ processed: 0, notificationsSent: 0 })),
}));

vi.mock("@thinkabell/shared", () => ({
  rateLimit: vi.fn(() => Promise.resolve(true)),
}));

describe("POST /api/cron/send-alerts", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CRON_SECRET = "test-secret";
  });

  it("should reject requests without authorization header", async () => {
    const request = new Request("http://localhost/api/cron/send-alerts", {
      method: "POST",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should reject requests with invalid bearer token", async () => {
    const request = new Request("http://localhost/api/cron/send-alerts", {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should allow requests with valid bearer token", async () => {
    const request = new Request("http://localhost/api/cron/send-alerts", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.processed).toBe(0);
    expect(data.notificationsSent).toBe(0);
  });

  it("should enforce rate limiting", async () => {
    const { rateLimit } = await import("@thinkabell/shared");
    (rateLimit as any).mockResolvedValue(false);

    const request = new Request("http://localhost/api/cron/send-alerts", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain("Rate limit exceeded");
  });
});
