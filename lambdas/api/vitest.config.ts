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
    env: {
      // 生成Lambdaを呼び出す経路を本番と同じ契約で検証する。
      SLIDE_GENERATOR_ARN: "arn:aws:lambda:us-east-1:123456789012:function:slide-generator-test",
    },
  },
});
