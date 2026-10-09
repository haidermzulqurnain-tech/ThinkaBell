/**
 * @file scripts/apply-schema.ts
 * @description Applies packages/database/schema.sql to a
 *   Supabase project over a direct Postgres connection.
 *
 * Supabase's JS/REST clients cannot run DDL, so the schema
 * must be applied either through the dashboard SQL editor or
 * over a direct connection. This script does the latter, so
 * the schema is scripted, repeatable, and safe to re-run:
 * schema.sql is fully idempotent (IF NOT EXISTS DDL,
 * DROP ... IF EXISTS before every CREATE POLICY/TRIGGER,
 * CREATE OR REPLACE FUNCTION).
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" pnpm db:apply
 *
 * SUPABASE_DB_URL is the "Connection string" from Supabase
 * Dashboard → Project Settings → Database (the direct URL,
 * port 5432). It is a separate admin credential from
 * SUPABASE_URL/SUPABASE_ANON_KEY — set it in your local
 * .env only, never on the app host.
 *
 * Supabase's managed Postgres notifies PostgREST on DDL
 * changes (pgrst_ddl_watch), so the REST schema cache
 * reloads automatically after this script runs — no manual
 * cache reload is needed.
 *
 * Exit code is non-zero when the schema could not be applied.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { assertConnectionString, createDatabaseClient } from "./lib/db-connection";

async function applySchema(): Promise<void> {
  const connectionString = assertConnectionString(process.env.SUPABASE_DB_URL);

  const schemaPath = join(process.cwd(), "packages", "database", "schema.sql");
  let schemaSql: string;
  try {
    schemaSql = readFileSync(schemaPath, "utf-8");
  } catch (err) {
    throw new Error(
      `cannot read ${schemaPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  console.log(`Applying ${schemaPath} ...`);

  const client = createDatabaseClient({
    connectionString,
    skipTlsVerify: process.env.SUPABASE_DB_SKIP_TLS_VERIFY === "1",
  });

  try {
    await client.connect();
    // pg's simple query protocol runs the whole script as
    // one implicit transaction: either every statement
    // applies or none do.
    await client.query(schemaSql);
    console.log("✅ Schema applied successfully.");
  } finally {
    await client.end();
  }
}

applySchema()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(`FAIL: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
