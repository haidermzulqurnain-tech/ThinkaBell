/**
 * @file scripts/verify-hostinger-deploy.ts
 * @description Fail-closed preflight verification for the Hostinger deployment.
 *
 * Run before uploading to Hostinger (or in the Deploy workflow, right after
 * packaging) to catch a broken bundle before it ships:
 *
 *   1. Standalone build output exists (apps/web/.next/standalone/apps/web/server.js)
 *   1b. Client assets are inside the standalone output (.next/static, public/)
 *   2. Hostinger entrypoint exists (apps/web/hostinger-server.js)
 *   3. Packaged bundle completeness (dist/hostinger-deploy/) when present
 *   4. Deploy workflow exists and references the required HOSTINGER_* secrets
 *
 * Environment variables (Supabase, API keys, encryption keys) are reported
 * as warnings: they are configured on the Hostinger Node.js panel, not in
 * the repository, so their absence here does not mean the bundle is broken.
 *
 * Exit code is non-zero when a critical check fails (the deploy would ship a
 * broken app); warnings exit zero.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

interface Check {
  label: string;
  detail: string;
}

const passed: Check[] = [];
const warnings: Check[] = [];
const errors: Check[] = [];

function pass(label: string, detail: string): void {
  passed.push({ label, detail });
}

function warn(label: string, detail: string): void {
  warnings.push({ label, detail });
}

function fail(label: string, detail: string): void {
  errors.push({ label, detail });
}

// 1. Standalone build output — the self-contained Next.js server.
const standaloneServer = join(
  ROOT,
  "apps",
  "web",
  ".next",
  "standalone",
  "apps",
  "web",
  "server.js",
);
if (existsSync(standaloneServer)) {
  pass("Standalone server", "apps/web/.next/standalone/apps/web/server.js");
} else {
  fail(
    "Standalone server missing",
    "Run 'pnpm build:standalone' — a plain 'next build' does not emit .next/standalone.",
  );
}

// 1b. Client assets inside the standalone output — `next build`
// with output:standalone does not copy .next/static or public/
// on its own; without them the server starts but pages 404 on
// /_next/static/* (breaks the repository-layout deploy path).
const standaloneStatic = join(
  ROOT,
  "apps",
  "web",
  ".next",
  "standalone",
  "apps",
  "web",
  ".next",
  "static",
);
if (existsSync(standaloneStatic)) {
  pass(
    "Standalone client assets",
    "apps/web/.next/standalone/apps/web/.next/static",
  );
} else {
  fail(
    "Standalone client assets missing",
    "Re-run 'pnpm build:standalone' — it copies .next/static and public/ into the standalone output.",
  );
}

// 2. Hostinger entrypoint — the configured Application Startup File.
const entrypoint = join(ROOT, "apps", "web", "hostinger-server.js");
if (existsSync(entrypoint)) {
  pass("Hostinger entrypoint", "apps/web/hostinger-server.js");
} else {
  fail(
    "Hostinger entrypoint missing",
    "apps/web/hostinger-server.js is the Application Startup File configured in hPanel.",
  );
}

// 3. Packaged bundle completeness — only when a bundle has been produced.
const bundleDir = join(ROOT, "dist", "hostinger-deploy");
if (existsSync(bundleDir)) {
  const required = [
    "hostinger-server.js",
    join("apps", "web", "server.js"),
    join("apps", "web", ".next", "static"),
    join("apps", "web", "public"),
  ];
  const missing = required.filter((rel) => !existsSync(join(bundleDir, rel)));
  if (missing.length === 0) {
    pass("Deploy bundle", "dist/hostinger-deploy/ is complete");
  } else {
    fail(
      "Deploy bundle incomplete",
      "dist/hostinger-deploy/ is missing: " +
        missing.join(", ") +
        " — re-run 'pnpm package:hostinger'.",
    );
  }
} else {
  warn(
    "Deploy bundle not packaged",
    "dist/hostinger-deploy/ not found — run 'pnpm package:hostinger' before a manual upload, or let the Deploy workflow build it.",
  );
}

// 4. Required runtime environment variables (advisory — set on Hostinger).
const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
  "ALERTS_API_KEY",
  "REVALIDATION_SECRET",
  "RETAILER_LINKS_API_KEY",
  "ENCRYPTION_KEY",
  "BLIND_INDEX_KEY",
];
const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missingEnv.length === 0) {
  pass("Runtime environment", "all required variables are set");
} else {
  warn(
    "Runtime environment",
    "configure on the Hostinger Node.js panel (Environment): " +
      missingEnv.join(", "),
  );
}

// 5. Deploy workflow — must exist and reference the required secrets.
const deployYml = join(ROOT, ".github", "workflows", "deploy.yml");
const REQUIRED_SECRETS = [
  "HOSTINGER_HOST",
  "HOSTINGER_USERNAME",
  "HOSTINGER_PASSWORD",
  "HOSTINGER_PORT",
  "HOSTINGER_DEPLOY_PATH",
];
if (existsSync(deployYml)) {
  const content = readFileSync(deployYml, "utf-8");
  const missingSecrets = REQUIRED_SECRETS.filter(
    (name) => !content.includes("secrets." + name),
  );
  if (missingSecrets.length === 0) {
    pass(
      "Deploy workflow",
      "deploy.yml references all required HOSTINGER_* secrets",
    );
  } else {
    warn(
      "Deploy workflow secrets",
      "deploy.yml does not reference: " + missingSecrets.join(", "),
    );
  }
} else {
  fail(
    "Deploy workflow missing",
    ".github/workflows/deploy.yml not found — the automated Hostinger deploy cannot run.",
  );
}

// Report.
console.log("==========================================");
console.log("  ThinkaBell Hostinger Deploy Preflight ");
console.log("==========================================");
for (const c of passed) {
  console.log("  [PASS] " + c.label + ": " + c.detail);
}
for (const c of warnings) {
  console.log("  [WARN] " + c.label + ": " + c.detail);
}
for (const c of errors) {
  console.log("  [FAIL] " + c.label + ": " + c.detail);
}
console.log("==========================================");

if (errors.length > 0) {
  console.error(
    "FAIL: " +
      errors.length +
      " critical issue(s) — the deployment would ship a broken app. Fix the errors above, then re-run.",
  );
  process.exit(1);
}

if (warnings.length > 0) {
  console.log(
    "WARN: " +
      warnings.length +
      " warning(s) — configure these on Hostinger/GitHub after deploy or the app will not run correctly.",
  );
}

console.log("PASS: deployment bundle is ready.");
