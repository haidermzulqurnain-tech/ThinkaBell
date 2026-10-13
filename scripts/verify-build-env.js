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
 * What is fatal here:
 *   - the wrong package manager (npm/yarn), because the workspace
 *     root is not resolvable without pnpm
 *   - an incomplete install, for the same reason
 *
 * What is only advisory:
 *   - a pnpm version that differs from the `packageManager` pin.
 *     pnpm-workspace.yaml sets `pmOnFail: warn`, so a host whose
 *     pnpm is newer than the pin is expected to continue rather
 *     than abort. Failing here would defeat that policy, so the
 *     mismatch is logged and the build proceeds. The pin is still
 *     the single source of truth for local dev and CI, where
 *     Corepack provides it.
 *
 * Both the pin and the actual version are read from the environment
 * (package.json / npm_config_user_agent) — nothing is hardcoded.
 */

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const WEB_NEXT_BIN = path.join(ROOT_DIR, "apps", "web", "node_modules", ".bin", "next");

/**
 * Expected package manager and pinned version, read from package.json so the
 * check never hardcodes them. `packageManager` ("pnpm@10.34.6") is the single
 * source of truth (Corepack and pnpm's version management honor it);
 * `devEngines.packageManager` is accepted as a fallback for hosts that
 * read only that field.
 */
function readExpected() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"));
  const engine = pkg.devEngines && pkg.devEngines.packageManager;
  const raw =
    pkg.packageManager ||
    (engine && engine.name && engine.version ? `${engine.name}@${engine.version}` : "");
  const match = /^([^@\s]+)@(.+)$/.exec(raw.trim());
  return {
    raw: raw.trim(),
    name: match ? match[1] : "pnpm",
    version: match ? match[2] : null,
  };
}

const expected = readExpected();

/** A clean, exact semver (no range operators) can be compared strictly. */
const isExactVersion = (v) => /^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$/.test(v);

/**
 * The package manager that invoked this script. npm, pnpm, and yarn all set
 * npm_config_user_agent for lifecycle scripts (e.g. "pnpm/10.34.6 npm/? ...").
 */
const userAgent = process.env.npm_config_user_agent || "";
const uaFirst = userAgent.split(" ")[0] || "";
const actualName = uaFirst.split("/")[0] || "unknown";
const actualVersion = uaFirst.split("/")[1] || "";

const pinnedLabel = `${expected.name}${expected.version ? `@${expected.version}` : ""}`;

const problems = [];
const warnings = [];

if (actualName !== expected.name) {
  problems.push(
    `wrong package manager: "${actualName}" — this workspace must be installed and built with ${pinnedLabel}`,
  );
} else if (
  expected.version &&
  isExactVersion(expected.version) &&
  actualVersion &&
  actualVersion !== expected.version
) {
  warnings.push(
    `${expected.name} version mismatch: running ${expected.name}@${actualVersion} ` +
      `while package.json pins ${expected.raw}. Continuing because pnpm-workspace.yaml ` +
      `sets "pmOnFail: warn" — the host's pnpm is used for this build.`,
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
  console.error(`   Package manager:  ${pinnedLabel}`);
  console.error("   Build command:    pnpm run build:standalone");
  console.error("   Output directory: (leave empty)");
  console.error("   Entry file:       apps/web/hostinger-server.js");
  console.error("   Root directory:   ./");
  console.error("   Application type: Other");
  console.error("");
  console.error("The package manager choice matters: npm does not read");
  console.error("pnpm-workspace.yaml, so a workspace install with npm leaves every");
  console.error("package without its dependencies. See docs/HOSTINGER_DEPLOYMENT.md.");
  process.exit(1);
}

for (const warning of warnings) {
  console.warn(`⚠️ ${warning}`);
}

console.log(`✅ Build environment: ${pinnedLabel} workspace installed`);
