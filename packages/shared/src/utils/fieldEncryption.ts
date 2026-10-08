/**
 * Field-level encryption utilities for PII data at rest.
 * Uses AES-256-GCM with environment-based key management.
 *
 * Key format: ENCRYPTION_KEY must be a 64-character hex string encoding
 * 32 raw bytes (e.g. output of `openssl rand -hex 32`).
 *
 * Contract:
 * - When no key is configured (ENCRYPTION_KEY unset), values pass through
 *   unchanged. This supports an opt-in rollout (see docs/ENCRYPTION_STRATEGY.md).
 * - When a key IS configured, encryption/decryption failures throw
 *   FieldEncryptionError instead of silently returning unencrypted or
 *   corrupted data (fail-closed).
 */

import { logger } from "./logger";

export type EncryptionKey = string;

export class FieldEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FieldEncryptionError";
  }
}

export function getEncryptionKey(): EncryptionKey | null {
  const key = process.env.ENCRYPTION_KEY || null;
  return key;
}

export function isEncryptionEnabled(): boolean {
  return isKeyValid(getEncryptionKey());
}

const IV_LENGTH = 12;
const HEX_KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

function isKeyValid(key: EncryptionKey | null): boolean {
  return key !== null && HEX_KEY_PATTERN.test(key);
}

function keyToBytes(key: EncryptionKey): Uint8Array<ArrayBuffer> {
  if (!isKeyValid(key)) {
    throw new FieldEncryptionError("ENCRYPTION_KEY must be a 64-character hex string (32 bytes), e.g. openssl rand -hex 32");
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(key.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importAesKey(key: EncryptionKey, usage: "encrypt" | "decrypt"): Promise<CryptoKey> {
  const keyData = keyToBytes(key);
  return crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, [usage]);
}

/**
 * Encrypt a PII field with AES-256-GCM. Output is base64(iv || ciphertext).
 * Returns null for null/empty input. Passes input through when no key is set.
 */
export async function encryptField(plaintext: string | null | undefined, key?: EncryptionKey | null): Promise<string | null> {
  if (!plaintext) return null;
  if (!key) return plaintext;

  try {
    const cryptoKey = await importAesKey(key, "encrypt");
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      new TextEncoder().encode(plaintext),
    );
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return bytesToBase64(combined);
  } catch (error) {
    if (error instanceof FieldEncryptionError) {
      throw error;
    }
    logger.error("[FieldEncryption] Encryption failed for PII field", error);
    throw new FieldEncryptionError("Failed to encrypt PII field");
  }
}

/**
 * Decrypt a PII field produced by encryptField.
 * Returns null for null input. Passes input through when no key is set.
 */
export async function decryptField(ciphertext: string | null | undefined, key?: EncryptionKey | null): Promise<string | null> {
  if (!ciphertext) return null;
  if (!key) return ciphertext;

  try {
    const cryptoKey = await importAesKey(key, "decrypt");
    const combined = base64ToBytes(ciphertext);
    if (combined.length <= IV_LENGTH) {
      throw new Error("Ciphertext too short");
    }
    const iv = combined.slice(0, IV_LENGTH);
    const encrypted = combined.slice(IV_LENGTH);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      encrypted,
    );
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    if (error instanceof FieldEncryptionError) {
      throw error;
    }
    logger.error("[FieldEncryption] Decryption failed for PII field", error);
    throw new FieldEncryptionError("Failed to decrypt PII field");
  }
}
