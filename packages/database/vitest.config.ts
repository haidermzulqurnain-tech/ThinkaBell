import { defineConfig } from "vitest/config";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/.turbo/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["**/index.ts", "**/*.test.ts", "**/*.spec.ts", "**/types.ts"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@thinkabell/config": resolve(__dirname, "../config/src/index.ts"),
      "@thinkabell/database": resolve(__dirname, "src/index.ts"),
      "@thinkabell/shared": resolve(__dirname, "../shared/src/index.ts"),
    },
  },
});