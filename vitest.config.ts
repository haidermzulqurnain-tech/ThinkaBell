import { defineConfig } from "vitest/config";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["packages/**/*.{test,spec}.?(c|m)[jt]s?(x)", "apps/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/.turbo/**"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["packages/**/src/**/*.{ts,tsx}", "apps/**/src/**/*.{ts,tsx}"],
      exclude: [
        "**/index.ts",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/types.ts",
        "**/types/index.ts",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
    isolate: true,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
  },
  resolve: {
    alias: {
      "@thinkabell/config": resolve(__dirname, "packages/config/src/index.ts"),
      "@thinkabell/database": resolve(__dirname, "packages/database/src/index.ts"),
      "@thinkabell/shared": resolve(__dirname, "packages/shared/src/index.ts"),
      "@thinkabell/edge-worker": resolve(
        __dirname,
        "packages/edge-worker/src/index.ts",
      ),
    },
  },
});