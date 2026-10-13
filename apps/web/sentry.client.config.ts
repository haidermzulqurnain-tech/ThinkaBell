import * as Sentry from "@sentry/nextjs";
// Imported from the subpath, not the package root: the root re-exports env.ts,
// which loads dotenv and therefore the Node builtins (fs, path, os, crypto).
// Those cannot be bundled for the browser, and this file runs there.
import { getClientSentryDsn, isSentryDsnConfigured } from "@thinkabell/config/sentry-dsn";

const SENTRY_DSN = getClientSentryDsn();

if (isSentryDsnConfigured(SENTRY_DSN)) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    debug: false,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
  });
}
