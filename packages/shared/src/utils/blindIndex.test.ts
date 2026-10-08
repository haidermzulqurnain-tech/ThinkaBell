/**
 * @file packages/shared/src/utils/blindIndex.test.ts
 * @description Unit tests for the HMAC-SHA256 blind index utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { computeBlindIndex, isBlindIndexEnabled } from "./blindIndex";

const TEST_KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
const OTHER_KEY = "ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100";

function expectedHmac(value: string, key: string): string {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(key.slice(i * 2, i * 2 + 2), 16);
  }
  return createHmac("sha256", bytes).update(value).digest("hex");
}

beforeEach(() => {
  delete process.env.BLIND_INDEX_KEY;
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.BLIND_INDEX_KEY;
});

describe("isBlindIndexEnabled", () => {
  it("should be false when BLIND_INDEX_KEY is unset", () => {
    expect(isBlindIndexEnabled()).toBe(false);
  });

  it("should be true for a valid 64-char hex key", () => {
    process.env.BLIND_INDEX_KEY = TEST_KEY;
    expect(isBlindIndexEnabled()).toBe(true);
  });

  it("should be false for a malformed key", () => {
    process.env.BLIND_INDEX_KEY = "abc";
    expect(isBlindIndexEnabled()).toBe(false);
  });
});

describe("computeBlindIndex", () => {
  it("should produce an HMAC-SHA256 hex digest with a valid key", () => {
    process.env.BLIND_INDEX_KEY = TEST_KEY;
    const result = computeBlindIndex("User@Example.COM");
    expect(result).toBe(expectedHmac("user@example.com", TEST_KEY));
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should normalize case and surrounding whitespace", () => {
    process.env.BLIND_INDEX_KEY = TEST_KEY;
    const a = computeBlindIndex("  User@Example.COM  ");
    const b = computeBlindIndex("user@example.com");
    expect(a).toBe(b);
  });

  it("should be deterministic for the same value and key", () => {
    expect(computeBlindIndex("user@example.com", TEST_KEY)).toBe(computeBlindIndex("user@example.com", TEST_KEY));
  });

  it("should differ for different values", () => {
    const a = computeBlindIndex("user@example.com", TEST_KEY);
    const b = computeBlindIndex("other@example.com", TEST_KEY);
    expect(a).not.toBe(b);
  });

  it("should differ for the same value under different keys", () => {
    const a = computeBlindIndex("user@example.com", TEST_KEY);
    const b = computeBlindIndex("user@example.com", OTHER_KEY);
    expect(a).not.toBe(b);
  });

  it("should use the explicit key argument over the env var", () => {
    process.env.BLIND_INDEX_KEY = TEST_KEY;
    const explicit = computeBlindIndex("user@example.com", OTHER_KEY);
    expect(explicit).toBe(expectedHmac("user@example.com", OTHER_KEY));
    expect(explicit).not.toBe(computeBlindIndex("user@example.com", TEST_KEY));
  });

  it("should fall back to lower-case value when no key is configured", () => {
    delete process.env.BLIND_INDEX_KEY;
    expect(computeBlindIndex("  User@Example.COM ")).toBe("user@example.com");
  });

  it("should fall back to lower-case value when key is malformed", () => {
    process.env.BLIND_INDEX_KEY = "not-hex";
    expect(computeBlindIndex("User@Example.COM")).toBe("user@example.com");
  });

  it("should handle empty input with a key", () => {
    process.env.BLIND_INDEX_KEY = TEST_KEY;
    expect(computeBlindIndex("")).toBe(expectedHmac("", TEST_KEY));
  });
});
