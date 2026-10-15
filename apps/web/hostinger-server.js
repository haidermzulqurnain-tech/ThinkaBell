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

// This file is the production entrypoint: it only ever starts the production
// server (`next start` or the standalone server), never `next dev`. So NODE_ENV
// must be `production` by the time Next boots.
//
// `next` warns — and enables dev-mode code paths — when NODE_ENV is
// `development` while running `start`, which is exactly what a host that leaves
// NODE_ENV at its default produces. It also warns for any value outside the
// documented set. Both are normalised here rather than inherited.
const STANDARD_NODE_ENVS = ["development", "production", "test"];

function normalizeNodeEnv() {
  const current = process.env.NODE_ENV;

  if (current === "production") return;

  const reason =
    current && STANDARD_NODE_ENVS.includes(current)
      ? // Standard, but wrong for this entrypoint: `next start` in development
        // mode both warns and changes behaviour.
        "this is the production entrypoint, which starts `next start`"
      : // Unknown value: Next warns about anything outside the documented set.
        `"${current ?? ""}" is not a valid NODE_ENV`;

  console.warn(
    `[Hostinger] NODE_ENV "${current ?? "(unset)"}" — normalizing to "production": ${reason}.`,
  );
  process.env.NODE_ENV = "production";
}

normalizeNodeEnv();

console.log(`[Hostinger] Starting ThinkaBell server on http://${HOSTNAME}:${PORT}`);

// Path to standalone server created by Next.js.
// Two layouts are supported:
// 1. Deployed Hostinger bundle: prepare-hostinger.js copies the standalone
//    output to the bundle root, so the server lives at apps/web/server.js
//    relative to this file.
// 2. Repository checkout after `pnpm build:standalone`: the server lives
//    under .next/standalone/apps/web/server.js.
const bundleServerPath = path.join(__dirname, "apps", "web", "server.js");
const repoServerPath = path.join(__dirname, ".next", "standalone", "apps", "web", "server.js");
const localServerPath = path.join(__dirname, "server.js");

const buildDir = path.join(__dirname, ".next");
const candidates = [
  ["deployed bundle", bundleServerPath],
  ["repository checkout", repoServerPath],
  ["bundle root", localServerPath],
];

// Log which layout was found and which was not. A "Starting..." that never
// reaches "Ready" is otherwise indistinguishable from a build that produced
// nothing, and this line is what tells the two apart.
const found = candidates.find(([, candidate]) => fs.existsSync(candidate));

if (found) {
  console.log(`[Hostinger] Layout: ${found[0]}`);
  console.log(`[Hostinger] Loading server bundle from: ${found[1]}`);
  require(found[1]);
} else {
  console.log("[Hostinger] Using `next start` (no standalone output; full-project deploy).");

  // `next start` needs the build output in the app directory. Report it
  // explicitly: a missing or empty .next is the cause of a server that hangs at
  // "Starting...", and the entry point is the only place that can say so.
  if (!fs.existsSync(buildDir)) {
    console.error(
      `[Hostinger] No .next directory at ${buildDir}. The build did not produce output where ` +
        "this entrypoint expects it, so `next start` cannot start.",
    );
  } else if (!fs.existsSync(path.join(buildDir, "BUILD_ID"))) {
    console.error(
      `[Hostinger] ${buildDir} exists but has no BUILD_ID — it is not a complete build. ` +
        "Check the build command in hPanel is `pnpm run build:standalone`.",
    );
  } else {
    console.log(`[Hostinger] Build output found: ${buildDir}`);
  }

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
