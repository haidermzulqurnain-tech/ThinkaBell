import { NextRequest, NextResponse } from "next/server";

/**
 * Generates a cryptographically random base64 nonce using the Web Crypto API,
 * which is available in both the Edge runtime (middleware) and Node.js.
 */
function generateNonce(): string {
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  let binary = "";
  for (const byte of randomBytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Per-request Content Security Policy with a cryptographically random nonce.
 * The nonce is injected into the request headers (x-nonce) so server components
 * can attach it to inline <script> tags (JSON-LD, hydration payloads).
 */
export function middleware(request: NextRequest) {
  const nonce = generateNonce();

  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";
  const posthogHostname = new URL(posthogHost).hostname;

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://cdn.onesignal.com https://cdn.posthog.com ${posthogHostname}`,
    "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    `connect-src 'self' https://api.thinkabell.click https://onesignal.com ${posthogHostname}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};