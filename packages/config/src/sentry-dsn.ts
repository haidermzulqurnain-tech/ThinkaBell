/**
 * @file packages/config/src/sentry-dsn.ts
 * @description Whether Sentry should be initialized, and the DSN to use.
 *
 * Kept in its own module, separate from `env.ts`, so the browser entry points
 * (`sentry.client.config.ts`) can import it without pulling in the `env`
 * singleton, which reads every non-public variable. This module only ever
 * touches the two `NEXT_PUBLIC_SENTRY_*` variables, and only when called.
 */

/**
 * Same shape check as the one the env schema applies, without importing it.
 * Duplicated deliberately: importing `envSchema` here would drag the whole
 * environment into any bundle that imports this function.
 *
 * A real DSN is `https://<key>@<host>/<projectId>` where the key is a single
 * alphanumeric token and the project id is a positive integer. The placeholder
 * shipped in .env.example fails both rules.
 */
function isSentryDsnShape(value: string): boolean {
  const match = /^https?:\/\/([^@/]+)@[^/]+\/(\d+)$/.exec(value.trim());
  if (!match) return false;
  const key = match[1] ?? "";
  return /^[0-9A-Za-z]+$/.test(key) && Number(match[2]) > 0;
}

/**
 * True when `dsn` is present and well-formed, i.e. Sentry should initialize.
 * An empty, undefined or malformed value is "not configured" — initialization
 * is skipped so the runtime does not log `Invalid Sentry Dsn` on every boot.
 */
export function isSentryDsnConfigured(dsn: string | undefined): boolean {
  if (typeof dsn !== "string") return false;
  const trimmed = dsn.trim();
  return trimmed !== "" && isSentryDsnShape(trimmed);
}

/** The client-side DSN, read from the `NEXT_PUBLIC_` variable Next inlines. */
export function getClientSentryDsn(): string | undefined {
  return process.env.NEXT_PUBLIC_SENTRY_DSN;
}
