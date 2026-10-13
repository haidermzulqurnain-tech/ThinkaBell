// Subpath, not the package root: the root re-exports env.ts. Server-side this
// would work, but keeping the import narrow means a future client-side import
// of this module cannot pull the whole environment into a browser bundle.
import { isSentryDsnConfigured } from "@thinkabell/config/sentry-dsn";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

    if (isSentryDsnConfigured(SENTRY_DSN)) {
      const Sentry = await import("@sentry/nextjs");
      Sentry.init({
        dsn: SENTRY_DSN,
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
        debug: false,
      });
    }
  }
}
