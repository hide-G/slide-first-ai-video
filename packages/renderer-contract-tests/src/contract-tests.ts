import { describe, it, expect } from "vitest";
import type { VideoRenderer } from "@slide-first/renderer-port";
import type { VideoManifest } from "@slide-first/shared-types";
import { createTestManifest, createTestRenderInput } from "./test-fixtures.js";

export interface ContractTestOptions {
  /** The renderer instance to test */
  renderer: VideoRenderer;
  /** The manifest to use for testing (defaults to createTestManifest()) */
  manifest?: VideoManifest;
  /** Whether renderChunk and assemble are expected to throw (placeholder impl) */
  expectRenderChunkThrows?: boolean;
  expectAssembleThrows?: boolean;
  /**
   * For implementations that call renderChunk/assemble,
   * provide mock ChunkResults to pass to assemble().
   */
  mockChunkResults?: (plan: Awaited<ReturnType<VideoRenderer["plan"]>>) => Array<{
    chunkIndex: number;
    artifactKey: string;
    frameCount: number;
  }>;
}

/**
 * Contract test factory for VideoRenderer implementations.
 * Both renderer implementations must pass these tests to confirm they correctly
 * implement the VideoRenderer port interface.
 */
export function createRendererContractTests(
  name: string,
  options: ContractTestOptions,
): void {
  const {
    renderer,
    manifest = createTestManifest(),
    expectRenderChunkThrows = false,
    expectAssembleThrows = false,
    mockChunkResults,
  } = options;

  describe(`VideoRenderer contract: ${name}`, () => {
    describe("plan()", () => {
      it("returns a RenderPlan with correct totalFrames calculation", async () => {
        const input = createTestRenderInput();
        const plan = await renderer.plan(input);

        // totalFrames = ceil(sum(slide.durationMs) * fps / 1000)
        const totalDurationMs = manifest.slides.reduce(
          (sum, s) => sum + s.durationMs,
          0,
        );
        const expectedFps = manifest.outputs["lt-full"]?.fps ?? 30;
        const expectedFrames = Math.ceil(
          (totalDurationMs * expectedFps) / 1000,
        );

        expect(plan.totalFrames).toBe(expectedFrames);
      });

      it("returns a RenderPlan with positive chunkCount", async () => {
        const input = createTestRenderInput();
        const plan = await renderer.plan(input);

        expect(plan.chunkCount).toBeGreaterThan(0);
      });

      it("returns a RenderPlan with correct fps", async () => {
        const input = createTestRenderInput();
        const plan = await renderer.plan(input);

        const expectedFps = manifest.outputs["lt-full"]?.fps ?? 30;
        expect(plan.fps).toBe(expectedFps);
      });

      it("returns a RenderPlan with correct resolution", async () => {
        const input = createTestRenderInput();
        const plan = await renderer.plan(input);

        const output = manifest.outputs["lt-full"];
        expect(plan.width).toBe(output?.width ?? 1920);
        expect(plan.height).toBe(output?.height ?? 1080);
      });

      it("returns a RenderPlan with valid intermediatePrefix", async () => {
        const input = createTestRenderInput();
        const plan = await renderer.plan(input);

        expect(plan.intermediatePrefix).toBeTruthy();
        expect(typeof plan.intermediatePrefix).toBe("string");
        expect(plan.intermediatePrefix.length).toBeGreaterThan(0);
      });

      it("preserves the original input in the plan", async () => {
        const input = createTestRenderInput();
        const plan = await renderer.plan(input);

        expect(plan.input).toEqual(input);
      });

      it("returns a chunks array with length equal to chunkCount", async () => {
        const input = createTestRenderInput();
        const plan = await renderer.plan(input);

        expect(Array.isArray(plan.chunks)).toBe(true);
        expect(plan.chunks.length).toBe(plan.chunkCount);
      });

      it("each chunk has plan and chunkIndex fields", async () => {
        const input = createTestRenderInput();
        const plan = await renderer.plan(input);

        for (let i = 0; i < plan.chunks.length; i++) {
          expect(plan.chunks[i].chunkIndex).toBe(i);
          expect(plan.chunks[i].plan).toBeDefined();
          expect(plan.chunks[i].plan.input).toEqual(input);
          expect(plan.chunks[i].plan.chunkCount).toBe(plan.chunkCount);
        }
      });

      it("calculates reasonable chunk sizes", async () => {
        const input = createTestRenderInput();
        const plan = await renderer.plan(input);

        // Chunk count should be reasonable relative to number of slides
        expect(plan.chunkCount).toBeLessThanOrEqual(manifest.slides.length);
        expect(plan.chunkCount).toBeGreaterThan(0);
      });
    });

    describe("renderChunk()", () => {
      if (expectRenderChunkThrows) {
        it("throws 'Not yet implemented' error for placeholder implementation", async () => {
          const input = createTestRenderInput();
          const plan = await renderer.plan(input);

          await expect(renderer.renderChunk(plan, 0)).rejects.toThrow(
            /not yet implemented/i,
          );
        });
      } else {
        it("produces a ChunkResult with valid artifactKey format", async () => {
          const input = createTestRenderInput();
          const plan = await renderer.plan(input);

          const result = await renderer.renderChunk(plan, 0);

          expect(result.chunkIndex).toBe(0);
          expect(result.artifactKey).toBeTruthy();
          expect(typeof result.artifactKey).toBe("string");
          expect(result.artifactKey).toMatch(/\.mp4$/);
        });

        it("produces a ChunkResult with correct chunkIndex", async () => {
          const input = createTestRenderInput();
          const plan = await renderer.plan(input);

          const result = await renderer.renderChunk(plan, 0);
          expect(result.chunkIndex).toBe(0);
        });

        it("produces a ChunkResult with positive frameCount", async () => {
          const input = createTestRenderInput();
          const plan = await renderer.plan(input);

          const result = await renderer.renderChunk(plan, 0);
          expect(result.frameCount).toBeGreaterThan(0);
        });
      }
    });

    describe("assemble()", () => {
      if (expectAssembleThrows) {
        it("throws 'Not yet implemented' error for placeholder implementation", async () => {
          const input = createTestRenderInput();
          const plan = await renderer.plan(input);
          const chunks = mockChunkResults
            ? mockChunkResults(plan)
            : [{ chunkIndex: 0, artifactKey: "test/chunk-000.mp4", frameCount: 150 }];

          await expect(renderer.assemble(plan, chunks)).rejects.toThrow(
            /not yet implemented/i,
          );
        });
      } else {
        it("produces a RenderOutput with correct resolution/fps metadata", async () => {
          const input = createTestRenderInput();
          const plan = await renderer.plan(input);

          const chunks = mockChunkResults
            ? mockChunkResults(plan)
            : [{ chunkIndex: 0, artifactKey: "test/chunk-000.mp4", frameCount: 150 }];

          const output = await renderer.assemble(plan, chunks);

          expect(output.outputKey).toBeTruthy();
          expect(typeof output.outputKey).toBe("string");
          expect(output.outputKey).toMatch(/\.mp4$/);
          expect(output.durationMs).toBeGreaterThan(0);
          expect(output.totalFrames).toBeGreaterThan(0);
        });

        it("produces totalFrames equal to sum of chunk frameCounts", async () => {
          const input = createTestRenderInput();
          const plan = await renderer.plan(input);

          const chunks = mockChunkResults
            ? mockChunkResults(plan)
            : [
                { chunkIndex: 0, artifactKey: "test/chunk-000.mp4", frameCount: 150 },
                { chunkIndex: 1, artifactKey: "test/chunk-001.mp4", frameCount: 100 },
              ];

          const output = await renderer.assemble(plan, chunks);

          const expectedFrames = chunks.reduce((s, c) => s + c.frameCount, 0);
          expect(output.totalFrames).toBe(expectedFrames);
        });

        it("produces durationMs consistent with totalFrames and fps", async () => {
          const input = createTestRenderInput();
          const plan = await renderer.plan(input);

          const chunks = mockChunkResults
            ? mockChunkResults(plan)
            : [{ chunkIndex: 0, artifactKey: "test/chunk-000.mp4", frameCount: 300 }];

          const output = await renderer.assemble(plan, chunks);

          const expectedDurationMs = Math.round(
            (output.totalFrames / plan.fps) * 1000,
          );
          expect(output.durationMs).toBe(expectedDurationMs);
        });
      }
    });
  });
}
