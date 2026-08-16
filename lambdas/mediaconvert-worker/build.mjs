import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "dist/index.js",
  external: ["@aws-sdk/*"],
  minify: false,
  sourcemap: false,
});
