/**
 * Shared helper that makes a Next.js `output: "standalone"` directory
 * runnable on its own.
 *
 * `next build` with `output: "standalone"` emits only the server runtime
 * (traced server chunks, server.js, manifests) — it does NOT copy the
 * client assets (`.next/static`) or `public/` files. Without them the
 * standalone server starts, but every page request 404s on its
 * `/_next/static/*` chunks.
 *
 * Assets are copied to both the standalone root and the nested app folder
 * (e.g. `apps/web/`) because the standalone server resolves them relative
 * to `server.js`; covering both layouts is defensive and matches how the
 * deploy bundle is assembled.
 */

const fs = require("fs");
const path = require("path");

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

/**
 * Copies `.next/static` and `public/` from the web app into a standalone
 * output directory so the standalone server can serve client assets.
 *
 * @param {string} repoRoot Absolute path to the repository root (the
 *   directory the standalone layout mirrors — where the build was
 *   invoked from).
 * @param {string} webDir Absolute path to the Next.js app (e.g. `<root>/apps/web`).
 * @param {string} standaloneDir Absolute path to the standalone output —
 *   `<root>/apps/web/.next/standalone` for a repository build, or the
 *   packaged bundle root (`dist/hostinger-deploy`) for a deploy bundle.
 */
function copyStandaloneAssets(repoRoot, webDir, standaloneDir) {
  const staticSrc = path.join(webDir, ".next", "static");
  const publicSrc = path.join(webDir, "public");

  // The standalone output mirrors the repository layout, so the app lives
  // at <standalone>/<path from the repository root to the app>.
  const nestedAppDir = path.join(standaloneDir, path.relative(repoRoot, webDir));

  console.log("Copying client static assets (.next/static)...");
  copyRecursiveSync(staticSrc, path.join(standaloneDir, ".next", "static"));
  copyRecursiveSync(staticSrc, path.join(nestedAppDir, ".next", "static"));

  if (fs.existsSync(publicSrc)) {
    console.log("Copying public assets...");
    copyRecursiveSync(publicSrc, path.join(standaloneDir, "public"));
    copyRecursiveSync(publicSrc, path.join(nestedAppDir, "public"));
  }
}

module.exports = { copyStandaloneAssets, copyRecursiveSync };
