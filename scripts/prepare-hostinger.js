/**
 * Hostinger Deployment Packaging Script
 *
 * Copies Next.js standalone build outputs, static chunks, and public assets
 * into an upload-ready directory: `dist/hostinger-deploy/`
 */

const fs = require("fs");
const path = require("path");

const { copyRecursiveSync, copyStandaloneAssets } = require("./lib/standalone-assets");

const ROOT_DIR = path.resolve(__dirname, "..");
const WEB_DIR = path.join(ROOT_DIR, "apps", "web");
const STANDALONE_DIR = path.join(WEB_DIR, ".next", "standalone");
const OUTPUT_DIR = path.join(ROOT_DIR, "dist", "hostinger-deploy");

console.log("==========================================");
console.log("  Packaging ThinkaBell for Hostinger Node  ");
console.log("==========================================");

if (!fs.existsSync(STANDALONE_DIR)) {
  console.error("❌ Standalone build not found at:", STANDALONE_DIR);
  console.error("   Run `pnpm build:standalone` first (a plain build does not emit .next/standalone).");
  process.exit(1);
}

// Clean and recreate destination
if (fs.existsSync(OUTPUT_DIR)) {
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
}
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

console.log("1. Copying standalone runtime bundle...");
copyRecursiveSync(STANDALONE_DIR, OUTPUT_DIR);

console.log("2. Copying static assets (.next/static) and public files...");
// Next.js standalone requires the client assets inside the output;
// copyStandaloneAssets places them at both the bundle root and the
// nested app folder (apps/web/).
copyStandaloneAssets(ROOT_DIR, WEB_DIR, OUTPUT_DIR);

console.log("3. Copying Hostinger startup server entrypoint...");
const hostingerServerSrc = path.join(WEB_DIR, "hostinger-server.js");
if (fs.existsSync(hostingerServerSrc)) {
  fs.copyFileSync(hostingerServerSrc, path.join(OUTPUT_DIR, "hostinger-server.js"));
}

console.log("==========================================");
console.log("✅ Hostinger deployment bundle ready in:");
console.log(`   ${OUTPUT_DIR}`);
console.log("==========================================");
console.log("Upload the contents of dist/hostinger-deploy/ to your Hostinger public_html or app directory.");
