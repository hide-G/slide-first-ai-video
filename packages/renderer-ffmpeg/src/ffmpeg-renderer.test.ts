import { vi, describe, it, expect, beforeEach } from "vitest";
import { createRendererContractTests, createTestManifest } from "@slide-first/renderer-contract-tests";
import { FfmpegRenderer } from "./ffmpeg-renderer.js";
import type { VideoManifest } from "@slide-first/shared-types";

// Mock child_process.execFile
vi.mock("node:child_process", () => ({
  execFile: vi.fn((_cmd: string, _args: string[], callback: Function) => {
    callback(null, "", "");
  }),
}));

const testManifest = createTestManifest();

function createMockFfmpegRenderer(manifest?: VideoManifest): FfmpegRenderer {
  const m = manifest ?? testManifest;
  return new FfmpegRenderer({
    fetchManifest: vi.fn().mockResolvedValue(m),
    resolveS3Path: (_bucket: string, key: string) => `/tmp/s3/${key}`,
    ffmpegPath: "/usr/bin/ffmpeg",
  });
}

// Run contract tests
createRendererContractTests("FfmpegRenderer", {
  renderer: createMockFfmpegRenderer(),
  manifest: testManifest,
  expectRenderChunkThrows: false,
  expectAssembleThrows: false,
});

// FFmpeg-specific tests
describe("FfmpegRenderer ffmpeg command construction", () => {
  let renderer: FfmpegRenderer;

  beforeEach(() => {
    renderer = createMockFfmpegRenderer();
  });

  describe("plan()", () => {
    it("calculates totalFrames from manifest slide durations", async () => {
      const plan = await renderer.plan({
        manifestKey: "decks/deck-1/v1/manifest.json",
        bucket: "test-bucket",
        outputType: "lt-full",
      });

      // 3 slides * 5000ms = 15000ms total, at 30fps = 450 frames
      expect(plan.totalFrames).toBe(450);
      expect(plan.fps).toBe(30);
      expect(plan.width).toBe(1920);
      expect(plan.height).toBe(1080);
    });

    it("divides work into chunks based on slide count", async () => {
      const plan = await renderer.plan({
        manifestKey: "decks/deck-1/v1/manifest.json",
        bucket: "test-bucket",
        outputType: "lt-full",
      });

      // 3 slides / maxSlidesPerChunk(5) = 1 chunk
      expect(plan.chunkCount).toBe(1);
    });

    it("creates multiple chunks for many slides", async () => {
      const bigManifest = createTestManifest({ slideCount: 12 });
      const bigRenderer = createMockFfmpegRenderer(bigManifest);

      const plan = await bigRenderer.plan({
        manifestKey: "decks/deck-1/v1/manifest.json",
        bucket: "test-bucket",
        outputType: "lt-full",
      });

      // 12 slides / 5 per chunk = 3 chunks (ceil)
      expect(plan.chunkCount).toBe(3);
    });
  });

  describe("buildChunkArgs()", () => {
    it("includes -loop 1 -t {duration} for each slide PNG", async () => {
      const plan = await renderer.plan({
        manifestKey: "decks/deck-1/v1/manifest.json",
        bucket: "test-bucket",
        outputType: "lt-full",
      });

      const slides = testManifest.slides;
      const args = renderer.buildChunkArgs(plan, slides, 0);

      // First slide: -loop 1 -t 5.000 -i /tmp/s3/decks/deck-1/v1/slides/slide-1.png
      const loopIdx = args.indexOf("-loop");
      expect(loopIdx).toBeGreaterThanOrEqual(0);
      expect(args[loopIdx + 1]).toBe("1");
      expect(args[loopIdx + 2]).toBe("-t");
      expect(args[loopIdx + 3]).toBe("5.000");
      expect(args[loopIdx + 4]).toBe("-i");
      expect(args[loopIdx + 5]).toContain("slide-1.png");
    });

    it("includes -f s16le -ar 24000 -ac 1 for PCM audio input", async () => {
      const plan = await renderer.plan({
        manifestKey: "decks/deck-1/v1/manifest.json",
        bucket: "test-bucket",
        outputType: "lt-full",
      });

      const slides = testManifest.slides;
      const args = renderer.buildChunkArgs(plan, slides, 0);

      // PCM audio format args
      const fIdx = args.indexOf("-f");
      expect(fIdx).toBeGreaterThanOrEqual(0);
      expect(args[fIdx + 1]).toBe("s16le");

      const arIdx = args.indexOf("-ar");
      expect(arIdx).toBeGreaterThanOrEqual(0);
      expect(args[arIdx + 1]).toBe("24000");

      const acIdx = args.indexOf("-ac");
      expect(acIdx).toBeGreaterThanOrEqual(0);
      expect(args[acIdx + 1]).toBe("1");
    });

    it("includes libx264 output with correct settings", async () => {
      const plan = await renderer.plan({
        manifestKey: "decks/deck-1/v1/manifest.json",
        bucket: "test-bucket",
        outputType: "lt-full",
      });

      const slides = testManifest.slides;
      const args = renderer.buildChunkArgs(plan, slides, 0);

      expect(args).toContain("-c:v");
      expect(args[args.indexOf("-c:v") + 1]).toBe("libx264");
      expect(args).toContain("-pix_fmt");
      expect(args[args.indexOf("-pix_fmt") + 1]).toBe("yuv420p");
      expect(args).toContain("-r");
      expect(args[args.indexOf("-r") + 1]).toBe("30");
    });

    it("includes resolution in filter_complex", async () => {
      const plan = await renderer.plan({
        manifestKey: "decks/deck-1/v1/manifest.json",
        bucket: "test-bucket",
        outputType: "lt-full",
      });

      const slides = testManifest.slides;
      const args = renderer.buildChunkArgs(plan, slides, 0);

      const filterIdx = args.indexOf("-filter_complex");
      expect(filterIdx).toBeGreaterThanOrEqual(0);
      const filterStr = args[filterIdx + 1];
      expect(filterStr).toContain("1920");
      expect(filterStr).toContain("1080");
    });
  });

  describe("buildAssembleArgs()", () => {
    it("concatenates chunks using filter_complex concat", async () => {
      const plan = await renderer.plan({
        manifestKey: "decks/deck-1/v1/manifest.json",
        bucket: "test-bucket",
        outputType: "lt-full",
      });

      const chunks = [
        { chunkIndex: 0, artifactKey: "test/chunk-000.mp4", frameCount: 150 },
        { chunkIndex: 1, artifactKey: "test/chunk-001.mp4", frameCount: 150 },
      ];

      const args = renderer.buildAssembleArgs(plan, chunks, "test/final.mp4");

      const filterIdx = args.indexOf("-filter_complex");
      expect(filterIdx).toBeGreaterThanOrEqual(0);
      const filterStr = args[filterIdx + 1];
      expect(filterStr).toContain("concat=n=2:v=1:a=1");
    });

    it("outputs with libx264 encoding", async () => {
      const plan = await renderer.plan({
        manifestKey: "decks/deck-1/v1/manifest.json",
        bucket: "test-bucket",
        outputType: "lt-full",
      });

      const chunks = [
        { chunkIndex: 0, artifactKey: "test/chunk-000.mp4", frameCount: 150 },
      ];

      const args = renderer.buildAssembleArgs(plan, chunks, "test/final.mp4");

      expect(args).toContain("-c:v");
      expect(args[args.indexOf("-c:v") + 1]).toBe("libx264");
      expect(args).toContain("-pix_fmt");
      expect(args[args.indexOf("-pix_fmt") + 1]).toBe("yuv420p");
    });
  });
});
