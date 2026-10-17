import { NextRequest, NextResponse } from "next/server";

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

export function middleware(request: NextRequest) {
  const nonce = generateNonce();

  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";
  const posthogHostname = new URL(posthogHost).hostname;

  const sentryDsn = process.env.SENTRY_DSN || "";
  let sentryIngestHost = "";
  try {
    sentryIngestHost = sentryDsn ? new URL(sentryDsn).hostname : "";
  } catch {}

  const connectSources = [
    "'self'",
    "https://onesignal.com",
    posthogHostname,
    "https://us-assets.i.posthog.com",
    "https://us.i.posthog.com",
    sentryIngestHost,
  ].filter(Boolean).join(" ");

  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    "https://cdn.onesignal.com",
    "https://cdn.posthog.com",
    "https://us-assets.i.posthog.com",
    posthogHostname,
  ].filter(Boolean).join(" ");

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSources}`,
    "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    `connect-src ${connectSources}`,
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