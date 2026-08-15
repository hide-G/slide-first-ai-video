import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    hookTimeout: 180_000,
    testTimeout: 180_000,
    exclude: ["node_modules", "dist", "cdk.out"],
  },
});
