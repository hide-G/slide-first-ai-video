import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // ブラウザではCJS配布物ではなく、共有する純粋な言語判定モジュールを直接束ねる。
      "@slide-first/core/narration-language": fileURLToPath(
        new URL("../packages/core/src/narration-language.ts", import.meta.url),
      ),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    port: 3000,
    proxy: {
      "/v1": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
