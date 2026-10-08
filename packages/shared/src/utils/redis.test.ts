/**
 * @file packages/shared/src/utils/redis.test.ts
 * @description Unit tests for Redis/Cache client
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockRedisGet, mockRedisSet, mockRedisDel, mockRedisIncr, mockRedisExpire, mockConfig } = vi.hoisted(() => ({
  mockRedisGet: vi.fn(),
  mockRedisSet: vi.fn(),
  mockRedisDel: vi.fn(),
  mockRedisIncr: vi.fn(),
  mockRedisExpire: vi.fn(),
  mockConfig: {
    UPSTASH_REDIS_REST_URL: "",
    UPSTASH_REDIS_REST_TOKEN: "",
  },
}));

vi.mock("@upstash/redis", () => ({
  Redis: class {
    get = mockRedisGet;
    set = mockRedisSet;
    del = mockRedisDel;
    incr = mockRedisIncr;
    expire = mockRedisExpire;
  },
}));

vi.mock("@thinkabell/config", () => ({
  env: mockConfig,
}));

vi.mock("./logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Redis Cache Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.UPSTASH_REDIS_REST_URL = "";
    mockConfig.UPSTASH_REDIS_REST_TOKEN = "";
  });

  describe("InMemoryCacheClient (fallback)", () => {
    it("should return null for non-existent keys", async () => {
      vi.resetModules();
      const { redis } = await import("./redis");
      const result = await redis.get("nonexistent");
      expect(result).toBeNull();
    });

    it("should store and retrieve values", async () => {
      vi.resetModules();
      const { redis } = await import("./redis");
      await redis.set("test-key", { data: "test-value" });
      const result = await redis.get("test-key");
      expect(result).toEqual({ data: "test-value" });
    });

    it("should handle TTL expiration", async () => {
      vi.resetModules();
      const { redis } = await import("./redis");
      await redis.set("expiring-key", "value", { ex: 0.01 });
      await new Promise((r) => setTimeout(r, 50));
      const result = await redis.get("expiring-key");
      expect(result).toBeNull();
    });

    it("should delete keys", async () => {
      vi.resetModules();
      const { redis } = await import("./redis");
      await redis.set("delete-me", "value");
      const result = await redis.del("delete-me");
      expect(result).toBe(1);
      const get = await redis.get("delete-me");
      expect(get).toBeNull();
    });

    it("should increment counters", async () => {
      vi.resetModules();
      const { redis } = await import("./redis");
      await redis.set("counter", 5);
      const result1 = await redis.incr("counter");
      const result2 = await redis.incr("counter");
      expect(result1).toBe(6);
      expect(result2).toBe(7);
    });

    it("should start counter at 0 for non-existent key", async () => {
      vi.resetModules();
      const { redis } = await import("./redis");
      const result = await redis.incr("new-counter");
      expect(result).toBe(1);
    });

    it("should set expiration on existing keys", async () => {
      vi.resetModules();
      const { redis } = await import("./redis");
      await redis.set("expire-test", "value");
      const result = await redis.expire("expire-test", 300);
      expect(result).toBe(1);
    });

    it("should return 0 when expiring non-existent key", async () => {
      vi.resetModules();
      const { redis } = await import("./redis");
      const result = await redis.expire("nonexistent", 300);
      expect(result).toBe(0);
    });

    it("should handle complex objects", async () => {
      vi.resetModules();
      const { redis } = await import("./redis");
      const complex = {
        numbers: [1, 2, 3],
        nested: { a: 1, b: { c: 2 } },
        nullValue: null,
      };
      await redis.set("complex", complex);
      const result = await redis.get("complex");
      expect(result).toEqual(complex);
    });
  });

  describe("Upstash Redis Client (when credentials provided)", () => {
    it("should use Upstash client when credentials are available", async () => {
      mockConfig.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
      mockConfig.UPSTASH_REDIS_REST_TOKEN = "test-token";
      mockRedisGet.mockResolvedValue("upstash-value");
      mockRedisSet.mockResolvedValue("OK");

      vi.resetModules();
      const { redis } = await import("./redis");
      await redis.set("test", "value");
      const result = await redis.get("test");
      expect(result).toBe("upstash-value");
    });

    it("should fall back to in-memory on Upstash init failure", async () => {
      mockConfig.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
      mockConfig.UPSTASH_REDIS_REST_TOKEN = "invalid-token";

      // Force Redis constructor to throw
      vi.resetModules();
      vi.doMock("@upstash/redis", () => ({
        Redis: class {
          constructor() {
            throw new Error("Invalid credentials");
          }
        },
      }));

      const { redis } = await import("./redis");
      await redis.set("fallback", "works");
      const result = await redis.get("fallback");
      expect(result).toBe("works");
    });
  });

  describe("ICacheClient interface compliance", () => {
    it("should implement all required ICacheClient methods", async () => {
      vi.resetModules();
      const { redis } = await import("./redis");
      expect(typeof redis.get).toBe("function");
      expect(typeof redis.set).toBe("function");
      expect(typeof redis.del).toBe("function");
      expect(typeof redis.incr).toBe("function");
      expect(typeof redis.expire).toBe("function");
    });
  });
});