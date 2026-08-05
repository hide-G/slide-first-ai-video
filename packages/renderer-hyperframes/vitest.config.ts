import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@slide-first/renderer-contract-tests": path.resolve(
        __dirname,
        "../renderer-contract-tests/src/index.ts",
      ),
    },
  },
  test: {
    globals: false,
    environment: "node",
  },
});
