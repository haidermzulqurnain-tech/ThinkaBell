/**
 * Database Backup Script
 *
 * Creates a SQL dump of the Supabase database using pg_dump.
 * Requires PostgreSQL client tools installed locally or in CI.
 *
 * Usage:
 *   pnpm tsx scripts/backup-db.ts
 *
 * Environment variables:
 *   SUPABASE_DB_CONNECTION_STRING - PostgreSQL connection string
 *   BACKUP_DIR - Optional output directory (default: ./backups)
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const SUPABASE_CONNECTION = process.env.SUPABASE_DB_CONNECTION_STRING;
const BACKUP_DIR = process.env.BACKUP_DIR || join(process.cwd(), "backups");

function generateBackupFileName(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
  const time = new Date().toISOString().replace(/[:.]/g, "-").split("T")[1]?.slice(0, 8) || "000000";
  return `thinkabell-backup-${timestamp}-${time}.sql`;
}

function runBackup(): void {
  if (!SUPABASE_CONNECTION) {
    console.error("❌ SUPABASE_DB_CONNECTION_STRING environment variable is not set.");
    console.error("   Export it from your Supabase project settings (Database > Connection string).");
    process.exit(1);
  }

  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const backupFile = join(BACKUP_DIR, generateBackupFileName());

  console.log("==========================================");
  console.log("  ThinkaBell Database Backup");
  console.log("==========================================");
  console.log(`Backup file: ${backupFile}`);

  try {
    const command = `pg_dump "${SUPABASE_CONNECTION}" --format=plain --no-owner --no-acl --verbose --file="${backupFile}"`;
    console.log("Running pg_dump...");
    execSync(command, { stdio: "inherit" });
    console.log("==========================================");
    console.log("✅ Backup completed successfully.");
    console.log(`   ${backupFile}`);
    console.log("==========================================");
  } catch (error) {
    console.error("❌ Backup failed:", error);
    process.exit(1);
  }
}

runBackup();
