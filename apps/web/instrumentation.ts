export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

    if (SENTRY_DSN) {
      const Sentry = await import("@sentry/nextjs");
      Sentry.init({
        dsn: SENTRY_DSN,
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
        debug: false,
      });
    }
  }
}