/**
 * @file packages/shared/src/utils/fieldEncryption.test.ts
 * @description Unit tests for AES-256-GCM field encryption utilities
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  encryptField,
  decryptField,
  getEncryptionKey,
  isEncryptionEnabled,
  FieldEncryptionError,
} from "./fieldEncryption";

const TEST_KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
const WRONG_KEY = "ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100";

afterEach(() => {
  delete process.env.ENCRYPTION_KEY;
  vi.clearAllMocks();
});

describe("getEncryptionKey / isEncryptionEnabled", () => {
  it("should return null when ENCRYPTION_KEY is unset", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(getEncryptionKey()).toBeNull();
    expect(isEncryptionEnabled()).toBe(false);
  });

  it("should be enabled for a valid 64-char hex key", () => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    expect(getEncryptionKey()).toBe(TEST_KEY);
    expect(isEncryptionEnabled()).toBe(true);
  });

  it("should be disabled for a malformed key", () => {
    process.env.ENCRYPTION_KEY = "not-a-hex-key";
    expect(getEncryptionKey()).toBe("not-a-hex-key");
    expect(isEncryptionEnabled()).toBe(false);
  });

  it("should be disabled for a valid-hex key of wrong length", () => {
    process.env.ENCRYPTION_KEY = "00112233445566778899aabbccddeeff";
    expect(isEncryptionEnabled()).toBe(false);
  });
});

describe("encryptField", () => {
  it("should return null for null input", async () => {
    expect(await encryptField(null, TEST_KEY)).toBeNull();
  });

  it("should return null for empty string input", async () => {
    expect(await encryptField("", TEST_KEY)).toBeNull();
  });

  it("should pass through plaintext when no key is provided", async () => {
    const result = await encryptField("user@example.com");
    expect(result).toBe("user@example.com");
  });

  it("should reject a malformed key instead of encrypting", async () => {
    await expect(encryptField("user@example.com", "short-key")).rejects.toThrow(FieldEncryptionError);
  });

  it("should encrypt and produce different ciphertexts for the same plaintext (random IV)", async () => {
    const a = await encryptField("user@example.com", TEST_KEY);
    const b = await encryptField("user@example.com", TEST_KEY);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a).not.toBe(b);
  });

  it("should round-trip encrypt then decrypt", async () => {
    const plaintext = "user@example.com";
    const encrypted = await encryptField(plaintext, TEST_KEY);
    const decrypted = await decryptField(encrypted as string, TEST_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it("should round-trip unicode content", async () => {
    const plaintext = "über-زبون@example.com";
    const encrypted = await encryptField(plaintext, TEST_KEY);
    const decrypted = await decryptField(encrypted as string, TEST_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it("should round-trip large PII payloads without stack overflow", async () => {
    const plaintext = "x".repeat(100_000);
    const encrypted = await encryptField(plaintext, TEST_KEY);
    const decrypted = await decryptField(encrypted as string, TEST_KEY);
    expect(decrypted).toBe(plaintext);
  });
});

describe("decryptField", () => {
  it("should return null for null input", async () => {
    expect(await decryptField(null, TEST_KEY)).toBeNull();
  });

  it("should pass through when no key is provided", async () => {
    const result = await decryptField("some-value");
    expect(result).toBe("some-value");
  });

  it("should throw when decrypting with the wrong key", async () => {
    const encrypted = await encryptField("user@example.com", TEST_KEY);
    await expect(decryptField(encrypted as string, WRONG_KEY)).rejects.toThrow(FieldEncryptionError);
  });

  it("should throw on malformed base64 input", async () => {
    await expect(decryptField("!!!not-base64!!!", TEST_KEY)).rejects.toThrow(FieldEncryptionError);
  });

  it("should throw on truncated ciphertext", async () => {
    const encrypted = await encryptField("user@example.com", TEST_KEY);
    const truncated = (encrypted as string).slice(0, 10);
    await expect(decryptField(truncated, TEST_KEY)).rejects.toThrow(FieldEncryptionError);
  });
});
