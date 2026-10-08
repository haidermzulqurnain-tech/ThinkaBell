import { headers } from "next/headers";

/**
 * Reads the per-request CSP nonce injected by middleware (x-nonce header).
 * Falls back to an empty string when middleware is absent (e.g. static export).
 */
export async function getNonce(): Promise<string> {
  const headersList = await headers();
  return headersList.get("x-nonce") ?? "";
}