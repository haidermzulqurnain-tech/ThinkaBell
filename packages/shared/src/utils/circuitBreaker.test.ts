import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CircuitBreaker } from "./circuitBreaker";

// Mock the logger
vi.mock("../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../utils/redis", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
  },
}));

describe("CircuitBreaker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should execute successfully on first call", async () => {
    const breaker = new CircuitBreaker("test-key");
    const fn = vi.fn().mockResolvedValue("success");

    const result = await breaker.execute(fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should allow recovery after failures within threshold", async () => {
    const breaker = new CircuitBreaker("test-key", 5, 30000);
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("success");

    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(fn);
      } catch {
        // Expected
      }
    }

    const result = await breaker.execute(fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should open circuit after threshold failures", async () => {
    const breaker = new CircuitBreaker("test-key");
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    for (let i = 0; i < 5; i++) {
      try {
        await breaker.execute(fn);
      } catch {
        // Expected
      }
    }

    await expect(breaker.execute(fn)).rejects.toThrow("Circuit breaker is open");
  });
});
