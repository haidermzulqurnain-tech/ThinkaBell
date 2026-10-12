/**
 * Build environment preflight.
 *
 * This monorepo is a pnpm workspace: the dependency
 * install must run with pnpm, because npm does not
 * read pnpm-workspace.yaml. A root `npm install`
 * installs only the root devDependencies and leaves
 * every workspace package without node_modules, so
 * the build fails deep inside the pipeline with
 * "next: command not found".
 *
 * The check runs before the build and fails fast
 * with the exact hPanel settings when the wrong
 * package manager or an incomplete install is
 * detected, turning that confusing failure into an
 * actionable one.
 */

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const WEB_NEXT_BIN = path.join(
  ROOT_DIR,
  "apps",
  "web",
  "node_modules",
  ".bin",
  "next",
);

/**
 * The package manager that invoked this script. npm,
 * pnpm, and yarn all set npm_config_user_agent for
 * lifecycle scripts (e.g. "pnpm/10.34.6 npm/? ...").
 */
const userAgent = process.env.npm_config_user_agent || "";
const packageManager = userAgent.split(" ")[0] || "unknown";

const problems = [];

if (!userAgent.startsWith("pnpm/")) {
  problems.push(
    `wrong package manager: "${packageManager}" — this workspace must be installed and built with pnpm`,
  );
}

if (!fs.existsSync(WEB_NEXT_BIN)) {
  problems.push(
    "workspace not installed: apps/web/node_modules is missing — run pnpm install at the repository root",
  );
}

if (problems.length > 0) {
  console.error("❌ Build environment check failed:");
  for (const problem of problems) {
    console.error(`   - ${problem}`);
  }
  console.error("");
  console.error("Set these hPanel → Node.js → Build settings:");
  console.error("   Package manager:  pnpm");
  console.error("   Build command:    pnpm run build:standalone");
  console.error("   Output directory: (leave empty)");
  console.error("   Entry file:       apps/web/hostinger-server.js");
  console.error("   Root directory:   ./");
  console.error("   Application type: Other");
  console.error("");
  console.error("npm does not read pnpm-workspace.yaml, so an npm");
  console.error("install leaves the workspace packages without");
  console.error("their dependencies. See docs/HOSTINGER_DEPLOYMENT.md.");
  process.exit(1);
}

console.log("✅ Build environment: pnpm workspace installed");
