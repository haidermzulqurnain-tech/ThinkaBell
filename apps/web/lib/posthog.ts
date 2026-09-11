import posthog from "posthog-js";

let posthogInitialized = false;

export function initPostHog(): void {
  if (typeof window === "undefined" || posthogInitialized) return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

  if (key) {
    posthog.init(key, {
      api_host: host,
      capture_pageview: true,
      capture_pageleave: true,
      persistence: "localStorage",
    });
    posthogInitialized = true;
  }
}

export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  if (typeof window !== "undefined" && posthogInitialized) {
    posthog.capture(name, properties);
  } else if (process.env.NODE_ENV !== "production") {
    console.debug(`[PostHog:Mock] Captured event "${name}":`, properties);
  }
}
