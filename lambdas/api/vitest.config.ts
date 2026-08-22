import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // テストは事前ビルド済みdistではなく、現在の共有型ソースを検証する。
      "@slide-first/shared-types": fileURLToPath(
        new URL("../../packages/shared-types/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    globals: false,
    environment: "node",
  },
});
