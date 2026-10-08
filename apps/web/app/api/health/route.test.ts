/**
 * @file apps/web/app/api/health/route.test.ts
 * @description Tests for the health check endpoint
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";

const mockFrom = vi.fn(() => ({
  select: vi.fn(() => ({
    limit: vi.fn(() => Promise.resolve({ error: null })),
  })),
})) as any;

vi.mock("@thinkabell/database", () => ({
  getSupabaseAnonClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock("@thinkabell/shared", () => ({
  redis: {
    set: vi.fn(() => Promise.resolve("OK")),
    get: vi.fn(() => Promise.resolve("pong")),
  },
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ error: null })),
      })),
    });
  });

  it("should return healthy status when all checks pass", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("healthy");
    expect(data.checks.database).toBe("ok");
    expect(data.checks.cache).toBe("ok");
    expect(data.timestamp).toBeDefined();
    expect(typeof data.responseTimeMs).toBe("number");
  });

  it("should return unhealthy status when database is down", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ error: { message: "Connection refused" } })),
      })),
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("unhealthy");
    expect(data.checks.database).toContain("degraded");
  });

  it("should return unhealthy status when Redis is down", async () => {
    const { redis } = await import("@thinkabell/shared");
    (redis.get as any).mockRejectedValue(new Error("Redis connection failed"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("unhealthy");
    expect(data.checks.cache).toContain("error");
  });
});
