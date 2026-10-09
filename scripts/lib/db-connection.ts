/**
 * @file scripts/lib/db-connection.ts
 * @description Shared direct-Postgres connection helper for
 *   database maintenance scripts (schema apply, seed, ...).
 *
 * Supabase's JS/REST clients cannot run DDL, so maintenance
 * scripts connect directly to the project's Postgres instance
 * with the admin "Connection string" from
 * Supabase Dashboard → Project Settings → Database.
 *
 * That string is a separate admin credential from
 * SUPABASE_URL/SUPABASE_ANON_KEY: it is read from
 * SUPABASE_DB_URL and must only ever be present in the
 * environment where maintenance scripts run (local .env or a
 * CI secret) — never on the application host.
 */

import { Client } from "pg";

export interface DbConnectionOptions {
  /** Raw postgresql:// connection string (required). */
  connectionString: string;
  /**
   * Skip TLS certificate verification. Only for projects whose
   * server certificate is not publicly signed; verified TLS is
   * the default and should be kept enabled whenever possible.
   */
  skipTlsVerify?: boolean;
}

/**
 * Creates a Postgres client for a Supabase project.
 * Supabase managed Postgres requires TLS on direct connections.
 */
export function createDatabaseClient(options: DbConnectionOptions): Client {
  const { connectionString, skipTlsVerify = false } = options;
  return new Client({
    connectionString,
    ssl: { rejectUnauthorized: !skipTlsVerify },
  });
}

/**
 * Validates the SUPABASE_DB_URL value and returns it.
 * Throws with actionable guidance when it is missing or malformed.
 */
export function assertConnectionString(value: string | undefined): string {
  if (!value) {
    throw new Error(
      "SUPABASE_DB_URL is not set.\n" +
        "Set it to the direct connection string from\n" +
        "Supabase Dashboard → Project Settings → Database → Connection string, e.g.\n" +
        '  SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" pnpm db:apply',
    );
  }
  if (!/^postgresql:\/\/[^ ]+@[^ /]+/.test(value)) {
    throw new Error(
      "SUPABASE_DB_URL is malformed — expected a postgresql:// connection string " +
        "with credentials, e.g.\n" +
        "  postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres",
    );
  }
  return value;
}
