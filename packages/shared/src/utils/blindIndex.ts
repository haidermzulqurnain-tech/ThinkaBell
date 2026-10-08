/**
 * Blind index utilities for deterministic PII lookups at rest.
 *
 * AES-GCM encryption uses a random IV, so encrypted values cannot be used
 * for exact-match lookups. The blind index stores a keyed HMAC-SHA256 digest
 * of the PII, enabling lookups (unsubscribe, preference updates) without
 * exposing the plaintext.
 *
 * Key format: BLIND_INDEX_KEY must be a 64-character hex string encoding
 * 32 raw bytes (e.g. `openssl rand -hex 32`).
 *
 * Dev fallback: when no valid key is configured, the blind index degrades to
 * `lower(trim(plaintext))`. This keeps local/seed workflows functional and
 * matches the SQL backfill (`lower(email)`). It is NOT a security control;
 * production must configure BLIND_INDEX_KEY.
 */

import { createHmac } from "crypto";
import { logger } from "./logger";

export type BlindIndexKey = string;

const HEX_KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

let warnedAboutMissingKey = false;

export function isBlindIndexEnabled(): boolean {
  const key = process.env.BLIND_INDEX_KEY || null;
  return key !== null && HEX_KEY_PATTERN.test(key);
}

function keyToBytes(key: BlindIndexKey): Uint8Array {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(key.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Compute the blind index for a PII value (currently email addresses).
 *
 * - With a valid BLIND_INDEX_KEY: hex-encoded HMAC-SHA256 over the normalized value.
 * - Without: `lower(trim(value))` (documented dev fallback, logs once).
 *
 * Normalization: case-folded and trimmed, matching how emails are stored.
 */
export function computeBlindIndex(value: string, key?: BlindIndexKey | null): string {
  const normalized = (value || "").toLowerCase().trim();

  const resolvedKey = key ?? process.env.BLIND_INDEX_KEY ?? null;
  if (resolvedKey && HEX_KEY_PATTERN.test(resolvedKey)) {
    return createHmac("sha256", keyToBytes(resolvedKey)).update(normalized).digest("hex");
  }

  if (!warnedAboutMissingKey && resolvedKey !== null) {
    warnedAboutMissingKey = true;
    logger.warn("[BlindIndex] BLIND_INDEX_KEY is set but malformed (expected 64-char hex). Falling back to lower-case index.");
  }
  if (!warnedAboutMissingKey && resolvedKey === null) {
    warnedAboutMissingKey = true;
    logger.warn("[BlindIndex] BLIND_INDEX_KEY is not set. Using lower-case fallback (dev mode only).");
  }

  return normalized;
}
