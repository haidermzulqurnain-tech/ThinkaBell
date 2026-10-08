/**
 * @file scripts/compliance-check.ts
 * @description CI compliance gate checks for ThinkaBell
 *
 * Run this script in CI to enforce:
 * 1. rel="sponsored" on all affiliate links
 * 2. FTC disclosure placement in deal pages
 * 3. Privacy-policy link presence in footer
 * 4. Brevo List-Unsubscribe header in email templates
 */

import { readFileSync, statSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const CHECKS = {
  sponsored: { passed: 0, failed: 0, errors: [] as string[] },
  ftc: { passed: 0, failed: 0, errors: [] as string[] },
  privacy: { passed: 0, failed: 0, errors: [] as string[] },
  unsubscribe: { passed: 0, failed: 0, errors: [] as string[] },
};

function checkFile(filePath: string): void {
  const relative = filePath.replace(ROOT, "").replace(/\\/g, "/");
  const content = readFileSync(filePath, "utf-8");

  // 1. Check for rel="sponsored" on affiliate links in web components/pages
  if (relative.includes("apps/web") && (relative.endsWith(".tsx") || relative.endsWith(".ts"))) {
    const hasAffiliateHref = /href=.*(amazon|ebay|walmart|thinkabell\.click\/deal)/.test(content);
    const hasSponsoredRel = /rel=.*sponsored/.test(content);

    if (hasAffiliateHref && !hasSponsoredRel) {
      CHECKS.sponsored.failed++;
      CHECKS.sponsored.errors.push(`${relative}: Affiliate link without rel="sponsored"`);
    } else {
      CHECKS.sponsored.passed++;
    }
  }

  // 2. Check for FTC disclosure in deal pages
  if (relative.includes("apps/web") && relative.includes("deal") && relative.endsWith(".tsx")) {
    const hasDisclosure = /disclosure|affiliate|sponsored/i.test(content);
    if (!hasDisclosure) {
      CHECKS.ftc.failed++;
      CHECKS.ftc.errors.push(`${relative}: Missing FTC disclosure`);
    } else {
      CHECKS.ftc.passed++;
    }
  }

  // 3. Check for privacy-policy link in footer
  if (relative.includes("apps/web") && relative.includes("Footer.tsx")) {
    const hasPrivacyLink = /privacy-policy|privacy_policy/i.test(content);
    if (!hasPrivacyLink) {
      CHECKS.privacy.failed++;
      CHECKS.privacy.errors.push(`${relative}: Missing privacy-policy link`);
    } else {
      CHECKS.privacy.passed++;
    }
  }

  // 4. Check for List-Unsubscribe header in email templates
  if (relative.includes("packages/shared") && relative.includes("notificationClient.ts")) {
    const hasUnsubscribe = /List-Unsubscribe/i.test(content);
    if (!hasUnsubscribe) {
      CHECKS.unsubscribe.failed++;
      CHECKS.unsubscribe.errors.push(`${relative}: Missing List-Unsubscribe header`);
    } else {
      CHECKS.unsubscribe.passed++;
    }
  }
}

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo", ".git"]);

function walk(dir: string): void {
  try {
    const entries = statSync(dir).isDirectory()
      ? require("fs").readdirSync(dir)
      : [];
    if (entries.length === 0 && statSync(dir).isFile()) {
      checkFile(dir);
      return;
    }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) {
        continue;
      }
      const fullPath = join(dir, entry);
      try {
        const stats = statSync(fullPath);
        if (stats.isDirectory()) {
          walk(fullPath);
        } else if (fullPath.match(/\.(tsx?)$/)) {
          checkFile(fullPath);
        }
      } catch {
        // skip inaccessible paths
      }
    }
  } catch {
    // skip inaccessible directories
  }
}

// Run checks
walk(join(ROOT, "apps/web"));
walk(join(ROOT, "packages/shared"));

// Report results
let exitCode = 0;

console.log("\n=== ThinkaBell Compliance Check ===\n");

for (const [name, result] of Object.entries(CHECKS)) {
  console.log(`[${name.toUpperCase()}]`);
  console.log(`  Passed: ${result.passed}`);
  console.log(`  Failed: ${result.failed}`);

  if (result.errors.length > 0) {
    console.log("  Errors:");
    for (const error of result.errors) {
      console.log(`    - ${error}`);
    }
    exitCode = 1;
  }
  console.log();
}

if (exitCode === 0) {
  console.log("✅ All compliance checks passed.\n");
} else {
  console.log("❌ Compliance checks failed. See errors above.\n");
}

process.exit(exitCode);
