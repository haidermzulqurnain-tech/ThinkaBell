/**
 * @file packages/shared/src/utils/rateLimit.test.ts
 * @description Unit tests for rate limiting function
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock redis
const mockIncr = vi.fn();
const mockExpire = vi.fn();

vi.mock("./redis", () => ({
  redis: {
    incr: mockIncr,
    expire: mockExpire,
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

// Mock logger
vi.mock("./logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Rate Limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("rateLimit function", () => {
    it("should allow requests within the limit", async () => {
      mockIncr.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);
      const { rateLimit } = await import("./rateLimit");

      const result = await rateLimit("test-key", 5, 60);
      expect(result).toBe(true);
      expect(mockIncr).toHaveBeenCalledWith("ratelimit:test-key");
    });

    it("should set TTL on first request", async () => {
      mockIncr.mockResolvedValue(1);
      const { rateLimit } = await import("./rateLimit");

      await rateLimit("test-key", 5, 60);
      expect(mockExpire).toHaveBeenCalledWith("ratelimit:test-key", 60);
    });

    it("should not set TTL on subsequent requests", async () => {
      mockIncr.mockResolvedValue(3);
      const { rateLimit } = await import("./rateLimit");

      await rateLimit("test-key", 5, 60);
      expect(mockExpire).not.toHaveBeenCalled();
    });

    it("should reject requests exceeding the limit", async () => {
      mockIncr.mockResolvedValue(6); // Exceeds limit of 5
      const { rateLimit } = await import("./rateLimit");

      const result = await rateLimit("test-key", 5, 60);
      expect(result).toBe(false);
    });

    it("should allow exactly at the limit", async () => {
      mockIncr.mockResolvedValue(5);
      const { rateLimit } = await import("./rateLimit");

      const result = await rateLimit("test-key", 5, 60);
      expect(result).toBe(true);
    });

    it("should use correct key format", async () => {
      mockIncr.mockResolvedValue(1);
      const { rateLimit } = await import("./rateLimit");

      await rateLimit("subscribe:192.168.1.1", 5, 60);
      expect(mockIncr).toHaveBeenCalledWith("ratelimit:subscribe:192.168.1.1");
    });

    it("should use custom window size", async () => {
      mockIncr.mockResolvedValue(1);
      const { rateLimit } = await import("./rateLimit");

      await rateLimit("key", 10, 120);
      expect(mockExpire).toHaveBeenCalledWith("ratelimit:key", 120);
    });

    it("should use custom limit", async () => {
      mockIncr.mockResolvedValue(100);
      const { rateLimit } = await import("./rateLimit");

      const result = await rateLimit("key", 100, 60);
      expect(result).toBe(true);
    });
  });

  describe("fail-open strategy", () => {
    it("should allow requests when redis fails", async () => {
      mockIncr.mockRejectedValue(new Error("Redis connection error"));
      const { rateLimit } = await import("./rateLimit");

      const result = await rateLimit("test-key", 5, 60);
      expect(result).toBe(true); // Fail-open
    });

    it("should log error when rate limit check fails", async () => {
      mockIncr.mockRejectedValue(new Error("Connection timeout"));
      const { rateLimit } = await import("./rateLimit");
      const { logger } = await import("./logger");

      await rateLimit("test-key", 5, 60);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle zero limit", async () => {
      mockIncr.mockResolvedValue(1);
      const { rateLimit } = await import("./rateLimit");

      const result = await rateLimit("key", 0, 60);
      expect(result).toBe(false);
    });

    it("should handle very large limits", async () => {
      mockIncr.mockResolvedValue(1);
      const { rateLimit } = await import("./rateLimit");

      const result = await rateLimit("key", 1000000, 60);
      expect(result).toBe(true);
    });

    it("should handle special characters in identifier", async () => {
      mockIncr.mockResolvedValue(1);
      const { rateLimit } = await import("./rateLimit");

      await rateLimit("key:with:colons:and-dashes", 5, 60);
      expect(mockIncr).toHaveBeenCalledWith("ratelimit:key:with:colons:and-dashes");
    });
  });
});