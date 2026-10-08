/**
 * Hostinger Deployment Packaging Script
 *
 * Copies Next.js standalone build outputs, static chunks, and public assets
 * into an upload-ready directory: `dist/hostinger-deploy/`
 */

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const WEB_DIR = path.join(ROOT_DIR, "apps", "web");
const STANDALONE_DIR = path.join(WEB_DIR, ".next", "standalone");
const STATIC_SRC = path.join(WEB_DIR, ".next", "static");
const PUBLIC_SRC = path.join(WEB_DIR, "public");
const OUTPUT_DIR = path.join(ROOT_DIR, "dist", "hostinger-deploy");

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return;

  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((child) => {
      copyRecursiveSync(path.join(src, child), path.join(dest, child));
    });
  } else {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

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

console.log("2. Copying static assets (.next/static)...");
// Next.js standalone requires static assets at .next/static inside the nested app folder
const targetWebStatic = path.join(OUTPUT_DIR, "apps", "web", ".next", "static");
const targetRootStatic = path.join(OUTPUT_DIR, ".next", "static");
copyRecursiveSync(STATIC_SRC, targetWebStatic);
copyRecursiveSync(STATIC_SRC, targetRootStatic);

if (fs.existsSync(PUBLIC_SRC)) {
  console.log("3. Copying public assets...");
  const targetWebPublic = path.join(OUTPUT_DIR, "apps", "web", "public");
  const targetRootPublic = path.join(OUTPUT_DIR, "public");
  copyRecursiveSync(PUBLIC_SRC, targetWebPublic);
  copyRecursiveSync(PUBLIC_SRC, targetRootPublic);
}

console.log("4. Copying Hostinger startup server entrypoint...");
const hostingerServerSrc = path.join(WEB_DIR, "hostinger-server.js");
if (fs.existsSync(hostingerServerSrc)) {
  fs.copyFileSync(hostingerServerSrc, path.join(OUTPUT_DIR, "hostinger-server.js"));
}

console.log("==========================================");
console.log("✅ Hostinger deployment bundle ready in:");
console.log(`   ${OUTPUT_DIR}`);
console.log("==========================================");
console.log("Upload the contents of dist/hostinger-deploy/ to your Hostinger public_html or app directory.");
