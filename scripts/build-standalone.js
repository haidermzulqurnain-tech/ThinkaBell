/**
 * Standalone Build Script (cross-platform)
 *
 * Runs the Next.js production build with OUTPUT=standalone so that
 * `.next/standalone` is emitted for `scripts/prepare-hostinger.js`.
 *
 * Setting the env var via the shell (`set OUTPUT=standalone` /
 * `OUTPUT=standalone ...`) is platform-dependent; this script injects
 * the variable into the child process environment instead, so the
 * command is identical on Windows, macOS, and Linux.
 *
 * The standalone output also requires symlink support. On Windows this
 * means Developer Mode (or elevated privileges); the check below fails
 * fast with actionable guidance instead of after a long build.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { copyStandaloneAssets } = require("./lib/standalone-assets");

const ROOT_DIR = path.resolve(__dirname, "..");
const WEB_DIR = path.join(ROOT_DIR, "apps", "web");
const STANDALONE_DIR = path.join(WEB_DIR, ".next", "standalone");

function checkSymlinkSupport() {
  if (process.platform !== "win32") return true;

  const probeTarget = path.join(os.tmpdir(), `thinkabell-symlink-probe-${Date.now()}.txt`);
  const probeLink = `${probeTarget}.link`;
  try {
    fs.writeFileSync(probeTarget, "probe");
    fs.symlinkSync(probeTarget, probeLink, "file");
    return true;
  } catch (error) {
    console.error("❌ Symlink creation failed — `output: standalone` requires symlink support.");
    console.error("   On Windows, enable Developer Mode (Settings → Privacy & security → For developers)");
    console.error("   or run from an elevated terminal, then retry.");
    console.error("   Alternatively, deploy the full project without the standalone bundle");
    console.error("   (see docs/HOSTINGER_DEPLOYMENT.md).");
    console.error(`   Underlying error: ${error.message}`);
    return false;
  } finally {
    for (const p of [probeLink, probeTarget]) {
      try {
        fs.rmSync(p, { force: true });
      } catch {
        // best-effort cleanup
      }
    }
  }
}

if (!checkSymlinkSupport()) {
  process.exit(1);
}

console.log("==========================================");
console.log("  Building @thinkabell/web (standalone)  ");
console.log("==========================================");

const child = spawn("pnpm", ["--filter", "@thinkabell/web", "run", "build"], {
  cwd: ROOT_DIR,
  env: { ...process.env, OUTPUT: "standalone" },
  stdio: "inherit",
  shell: true,
});

child.on("error", (error) => {
  console.error("❌ Failed to start the build:", error.message);
  process.exit(1);
});

child.on("exit", (code) => {
  if (code !== 0) {
    console.error(`❌ Build failed with exit code ${code}.`);
    process.exit(code ?? 1);
  }

  if (!fs.existsSync(STANDALONE_DIR)) {
    console.error("❌ Build completed but `.next/standalone` was not emitted.");
    console.error("   Verify that no local `.env` file overrides OUTPUT.");
    process.exit(1);
  }

  // `next build` with output:standalone emits only the server runtime.
  // Copy the client assets (.next/static) and public/ files into the
  // standalone output so the repository layout is runnable on its own
  // (e.g. Hostinger's native GitHub integration, which builds in the
  // repository rather than in a packaged bundle).
  copyStandaloneAssets(ROOT_DIR, WEB_DIR, STANDALONE_DIR);

  console.log("==========================================");
  console.log("✅ Standalone build ready at:");
  console.log(`   ${STANDALONE_DIR}`);
  console.log("   Next: pnpm prepare:hostinger");
  console.log("==========================================");
});
