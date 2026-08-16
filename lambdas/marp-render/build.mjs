/**
 * Build script for marp-render Lambda.
 *
 * 1. esbuild bundle src/index.ts -> dist/index.js
 *    - external: @sparticuz/chromium, puppeteer-core (need node_modules at runtime)
 *    - external: @aws-sdk/* (provided by Lambda runtime)
 * 2. Copy assets to dist/assets/:
 *    - noto-sans-jp-japanese-400-normal.woff2 -> noto-sans-jp.woff2
 *    - pdfjs-dist/build/pdf.min.mjs
 *    - pdfjs-dist/build/pdf.worker.min.mjs
 * 3. Copy select node_modules to dist/node_modules/:
 *    - @sparticuz/chromium (and its transitive deps)
 *    - puppeteer-core (and its transitive deps)
 *    - Resolves pnpm symlinks, excludes @napi-rs, @fontsource, pdfjs-dist, *.map files
 */

import { build } from "esbuild";
import { cp, mkdir, rm, readdir, readFile, stat, unlink, realpath, lstat } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { existsSync, realpathSync, readdirSync, statSync } from "node:fs";

const ROOT = resolve(import.meta.dirname);
const DIST = join(ROOT, "dist");
const NODE_MODULES = join(ROOT, "node_modules");

// Clean dist
await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

// 1. esbuild bundle
await build({
  entryPoints: [join(ROOT, "src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: join(DIST, "index.js"),
  external: [
    "@sparticuz/chromium",
    "puppeteer-core",
    "@aws-sdk/*",
  ],
  minify: false,
  sourcemap: false,
});

console.log("[marp-render] esbuild bundle complete");

// 2. Copy assets
const assetsDir = join(DIST, "assets");
await mkdir(assetsDir, { recursive: true });

// Font file
const fontSrc = join(NODE_MODULES, "@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff2");
await cp(fontSrc, join(assetsDir, "noto-sans-jp.woff2"));

// pdf.js files
const pdfjsSrc = join(NODE_MODULES, "pdfjs-dist/build");
await cp(join(pdfjsSrc, "pdf.min.mjs"), join(assetsDir, "pdf.min.mjs"));
await cp(join(pdfjsSrc, "pdf.worker.min.mjs"), join(assetsDir, "pdf.worker.min.mjs"));

console.log("[marp-render] assets copied");

// 3. Copy select node_modules (resolve pnpm symlinks)
const distNodeModules = join(DIST, "node_modules");
await mkdir(distNodeModules, { recursive: true });

// Exclusion list - packages already bundled by esbuild or not needed at runtime
const excludePatterns = [
  "@napi-rs",
  "@fontsource",
  "pdfjs-dist",
  // @puppeteer/browsers is only for downloading browser binaries; @sparticuz/chromium provides the binary
  "@puppeteer/browsers",
  // zod is already bundled by esbuild (via @slide-first/shared-types)
  "zod",
  // @types packages are not needed at runtime
  "@types",
  "undici-types",
];

function shouldExclude(pkgName) {
  return excludePatterns.some((pattern) => pkgName.startsWith(pattern));
}

/**
 * Recursively collect all packages that a given package depends on.
 * We look in the pnpm virtual store for the package and its co-located deps.
 */
const collected = new Set();

async function collectPackage(pkgName, searchDir) {
  if (collected.has(pkgName)) return;
  if (shouldExclude(pkgName)) return;
  collected.add(pkgName);

  // Find the real directory of the package
  const localPath = join(searchDir, pkgName);
  if (!existsSync(localPath)) return;

  const realDir = realpathSync(localPath);

  // Copy this package to dist/node_modules
  const destPath = join(distNodeModules, pkgName);
  await mkdir(dirname(destPath), { recursive: true });
  await cp(realDir, destPath, { recursive: true, dereference: true });

  // Check for this package's own deps (in sibling node_modules in pnpm virtual store)
  const pkgJsonPath = join(realDir, "package.json");
  if (!existsSync(pkgJsonPath)) return;

  const pkgJson = JSON.parse(await readFile(pkgJsonPath, "utf-8"));
  const deps = { ...(pkgJson.dependencies || {}), ...(pkgJson.optionalDependencies || {}) };

  // In pnpm, transitive deps are siblings in the same virtual store node_modules directory
  // e.g. .pnpm/puppeteer-core@24.2.0/node_modules/puppeteer-core -> sibling dir is ../
  // For scoped packages: .pnpm/@sparticuz+chromium@133.0.0/node_modules/@sparticuz/chromium -> go up 2
  const isScoped = pkgName.startsWith("@");
  const pnpmSiblingDir = isScoped ? join(realDir, "../../") : dirname(realDir);

  for (const dep of Object.keys(deps)) {
    if (shouldExclude(dep)) continue;
    if (collected.has(dep)) continue;

    // Check if dep exists as sibling in pnpm store
    const siblingPath = join(pnpmSiblingDir, dep);
    if (existsSync(siblingPath)) {
      await collectPackage(dep, pnpmSiblingDir);
    } else {
      // Try root node_modules
      const rootPath = join(NODE_MODULES, dep);
      if (existsSync(rootPath)) {
        await collectPackage(dep, NODE_MODULES);
      }
    }
  }
}

// Start from the two external packages
const chromiumPnpmDir = join(NODE_MODULES, ".pnpm/@sparticuz+chromium@133.0.0/node_modules");
const puppeteerPnpmDir = join(NODE_MODULES, ".pnpm/puppeteer-core@24.2.0/node_modules");

if (existsSync(chromiumPnpmDir)) {
  await collectPackage("@sparticuz/chromium", chromiumPnpmDir);
} else {
  await collectPackage("@sparticuz/chromium", NODE_MODULES);
}

if (existsSync(puppeteerPnpmDir)) {
  await collectPackage("puppeteer-core", puppeteerPnpmDir);
} else {
  await collectPackage("puppeteer-core", NODE_MODULES);
}

console.log(`[marp-render] copied ${collected.size} packages to dist/node_modules`);

// 4. Remove *.map files from dist/node_modules
async function removeMapFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await removeMapFiles(fullPath);
      } else if (entry.name.endsWith(".map")) {
        await unlink(fullPath);
      }
    }
  } catch {
    // Ignore errors
  }
}

await removeMapFiles(distNodeModules);
console.log("[marp-render] cleaned .map files");

// 5. Verify no remaining symlinks
async function findSymlinks(dir) {
  const results = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        results.push(fullPath);
      } else if (entry.isDirectory()) {
        results.push(...(await findSymlinks(fullPath)));
      }
    }
  } catch {
    // Ignore
  }
  return results;
}

const symlinks = await findSymlinks(DIST);
if (symlinks.length > 0) {
  console.warn(`[marp-render] WARNING: found ${symlinks.length} remaining symlinks:`);
  for (const s of symlinks) {
    console.warn(`  ${s}`);
  }
}

// 6. Report final size
// du はWindowsに存在しないため、Nodeでサイズを集計する（開発機はWindows 10のためシェル依存を避ける）
function directorySize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += directorySize(full);
    } else if (entry.isFile()) {
      total += statSync(full).size;
    }
  }
  return total;
}

const distBytes = directorySize(DIST);
const distMb = (distBytes / 1024 / 1024).toFixed(1);
console.log(`[marp-render] dist size: ${distMb} MB`);

// Lambdaの展開後サイズ上限は250MB。余裕を見て200MBを超えたら失敗させる
const LIMIT_MB = 200;
if (Number(distMb) > LIMIT_MB) {
  console.error(`[marp-render] ERROR: dist size ${distMb} MB exceeds ${LIMIT_MB} MB`);
  process.exit(1);
}

console.log("[marp-render] build complete");
