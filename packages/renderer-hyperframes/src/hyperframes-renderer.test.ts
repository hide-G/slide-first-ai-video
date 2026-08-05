import { vi } from "vitest";
import { createRendererContractTests, createTestManifest } from "@slide-first/renderer-contract-tests";
import { HyperframesRenderer } from "./hyperframes-renderer.js";

const testManifest = createTestManifest();

const renderer = new HyperframesRenderer({
  fetchManifest: vi.fn().mockResolvedValue(testManifest),
});

// Run contract tests - renderChunk and assemble are expected to throw
createRendererContractTests("HyperframesRenderer", {
  renderer,
  manifest: testManifest,
  expectRenderChunkThrows: true,
  expectAssembleThrows: true,
});
