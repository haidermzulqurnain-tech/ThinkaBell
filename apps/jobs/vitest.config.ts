import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    setupFiles: ["../../vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@thinkabell/config": resolve(__dirname, "../../packages/config/src/index.ts"),
      "@thinkabell/database": resolve(__dirname, "../../packages/database/src/index.ts"),
      "@thinkabell/shared": resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
});
