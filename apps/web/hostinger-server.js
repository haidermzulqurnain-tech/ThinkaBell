/**
 * Hostinger Node.js Production Entrypoint
 *
 * This script runs the Next.js standalone server with appropriate port binding
 * and graceful process termination handling for Hostinger's hosting environment.
 */

const path = require("path");
const fs = require("fs");

// Detect port assigned by Hostinger / Cloud environment
const PORT = process.env.PORT || 3000;
const HOSTNAME = process.env.HOSTNAME || "0.0.0.0";

process.env.PORT = String(PORT);
process.env.HOSTNAME = HOSTNAME;

console.log(`[Hostinger] Starting ThinkaBell server on http://${HOSTNAME}:${PORT}`);

// Path to standalone server created by Next.js.
// Two layouts are supported:
// 1. Deployed Hostinger bundle: prepare-hostinger.js copies the standalone
//    output to the bundle root, so the server lives at apps/web/server.js
//    relative to this file.
// 2. Repository checkout after `pnpm build:standalone`: the server lives
//    under .next/standalone/apps/web/server.js.
const bundleServerPath = path.join(__dirname, "apps", "web", "server.js");
const repoServerPath = path.join(
  __dirname,
  ".next",
  "standalone",
  "apps",
  "web",
  "server.js",
);
const localServerPath = path.join(__dirname, "server.js");

let serverEntry = null;

if (fs.existsSync(bundleServerPath)) {
  serverEntry = bundleServerPath;
} else if (fs.existsSync(repoServerPath)) {
  serverEntry = repoServerPath;
} else if (fs.existsSync(localServerPath)) {
  serverEntry = localServerPath;
}

if (serverEntry) {
  console.log(`[Hostinger] Loading server bundle from: ${serverEntry}`);
  require(serverEntry);
} else {
  // Fallback: no standalone build is present (a plain `next build`
  // was run). Start the standard Next.js production server from the
  // app directory so Next.js finds next.config.js and the .next
  // build output. PORT is already set above from the environment.
  console.log("[Hostinger] Standalone server not found. Falling back to `next start`.");
  process.chdir(__dirname);
  process.argv = [
    process.argv[0],
    path.join(__dirname, "node_modules", "next", "dist", "bin", "next"),
    "start",
  ];
  require("next/dist/bin/next");
}

// Graceful shutdown handling
process.on("SIGTERM", () => {
  console.log("[Hostinger] SIGTERM received. Gracefully shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[Hostinger] SIGINT received. Shutting down...");
  process.exit(0);
});
