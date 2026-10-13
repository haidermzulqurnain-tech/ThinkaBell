/**
 * @file scripts/apply-schema.ts
 * @description Applies packages/database/schema.sql, then every not-yet-applied
 *   file in packages/database/migrations/, to a Supabase project over a direct
 *   Postgres connection.
 *
 * Supabase's JS/REST clients cannot run DDL, so the schema
 * must be applied either through the dashboard SQL editor or
 * over a direct connection. This script does the latter, so
 * the schema is scripted, repeatable, and safe to re-run:
 * schema.sql is fully idempotent (IF NOT EXISTS DDL,
 * DROP ... IF EXISTS before every CREATE POLICY/TRIGGER,
 * CREATE OR REPLACE FUNCTION).
 *
 * Migrations are discovered at runtime rather than listed here, so adding a
 * file to packages/database/migrations is enough to have it applied — no edit
 * to this script. Each applied filename is recorded in public.schema_migrations,
 * which is what makes the run idempotent and lets a migration be non-idempotent
 * by construction (it only ever runs once).
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
 * Exit code is non-zero when the schema or a migration could not be applied.
 */

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import type { Client } from "pg";
import { assertConnectionString, createDatabaseClient } from "./lib/db-connection";

const MIGRATIONS_DIR = join("packages", "database", "migrations");

interface Migration {
  name: string;
  sql: string;
}

/**
 * Migration files, in filename order. The numeric prefix is what makes the
 * order deterministic across filesystems.
 */
function listMigrations(cwd: string): Migration[] {
  const dir = join(cwd, MIGRATIONS_DIR);

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    // No migrations directory is a normal state, not an error.
    return [];
  }

  return entries
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    .map((name) => ({ name, sql: readFileSync(join(dir, name), "utf-8") }));
}

/** Filenames already applied, so re-running the script is a no-op for them. */
async function appliedMigrations(client: Client): Promise<Set<string>> {
  await client.query(`
    create table if not exists public.schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const result = await client.query<{ filename: string }>(
    "select filename from public.schema_migrations",
  );
  return new Set(result.rows.map((row) => row.filename));
}

async function applyMigrations(client: Client, cwd: string): Promise<number> {
  const applied = await appliedMigrations(client);
  const pending = listMigrations(cwd).filter((migration) => !applied.has(migration.name));

  if (pending.length === 0) {
    console.log("No pending migrations.");
    return 0;
  }

  let count = 0;
  for (const migration of pending) {
    console.log(`Applying ${MIGRATIONS_DIR}/${migration.name} ...`);
    // The simple query protocol wraps each call in an implicit transaction,
    // so a failing migration leaves no partial state and no applied_at row.
    await client.query(migration.sql);
    await client.query("insert into public.schema_migrations (filename) values ($1)", [
      migration.name,
    ]);
    count += 1;
    console.log(`✅ Applied ${migration.name}`);
  }

  return count;
}

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

    const applied = await applyMigrations(client, process.cwd());
    if (applied > 0) {
      console.log(`✅ ${applied} migration(s) applied.`);
    }
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
