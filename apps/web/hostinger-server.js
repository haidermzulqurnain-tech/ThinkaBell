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

// Path to standalone server created by Next.js
const standaloneServerPath = path.join(__dirname, ".next", "standalone", "apps", "web", "server.js");
const localServerPath = path.join(__dirname, "server.js");

let serverEntry = null;

if (fs.existsSync(standaloneServerPath)) {
  serverEntry = standaloneServerPath;
} else if (fs.existsSync(localServerPath)) {
  serverEntry = localServerPath;
} else {
  // Fallback: run next start via node_modules
  console.log("[Hostinger] Standalone server not found. Falling back to standard Next.js CLI runner.");
  require("next/dist/bin/next");
}

if (serverEntry) {
  console.log(`[Hostinger] Loading server bundle from: ${serverEntry}`);
  require(serverEntry);
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
