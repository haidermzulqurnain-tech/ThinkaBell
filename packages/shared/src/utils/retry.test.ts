import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { retryWithBackoff } from "./retry";

describe("retryWithBackoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await retryWithBackoff(fn, { maxAttempts: 3 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on retryable errors and eventually succeed", async () => {
    const fn = vi.fn();
    fn.mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("ETIMEDOUT"))
      .mockResolvedValue("success");

    const result = await retryWithBackoff(fn, {
      maxAttempts: 3,
      initialDelayMs: 10,
      retryableStatuses: [],
    });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should not retry non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("permanent failure"));

    await expect(
      retryWithBackoff(fn, { maxAttempts: 2, initialDelayMs: 10, retryableStatuses: [] }),
    ).rejects.toThrow("permanent failure");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on timeout errors", async () => {
    const fn = vi.fn();
    fn.mockRejectedValueOnce(new Error("Request timeout"))
      .mockResolvedValue("success");

    const result = await retryWithBackoff(fn, {
      maxAttempts: 3,
      initialDelayMs: 10,
      retryableStatuses: [],
    });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should retry on retryable HTTP status errors", async () => {
    const fn = vi.fn();
    const err1 = new Error("HTTP 429") as Error & { status: number };
    err1.status = 429;
    const err2 = new Error("HTTP 503") as Error & { status: number };
    err2.status = 503;
    fn.mockRejectedValueOnce(err1).mockRejectedValueOnce(err2).mockResolvedValue("success");

    const result = await retryWithBackoff(fn, {
      maxAttempts: 3,
      initialDelayMs: 10,
      retryableStatuses: [429, 503],
    });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
