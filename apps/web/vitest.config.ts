import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["app/**/*.{test,spec}.?(c|m)[jt]s?(x)", "components/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/.turbo/**"],
    setupFiles: ["../../vitest.setup.ts"],
  },
    resolve: {
      alias: {
        "@": resolve(__dirname, "."),
        "@thinkabell/config": resolve(__dirname, "../../packages/config/src/index.ts"),
      "@thinkabell/database": resolve(__dirname, "../../packages/database/src/index.ts"),
      "@thinkabell/shared": resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@thinkabell/jobs": resolve(__dirname, "../jobs/src/index.ts"),
    },
  },
});
