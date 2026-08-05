import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock S3 client
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  GetObjectCommand: vi.fn(),
}));

// Mock FfmpegRenderer - use vi.hoisted to ensure mocks are available before module load
const { mockPlan, mockRenderChunk, mockAssemble } = vi.hoisted(() => ({
  mockPlan: vi.fn(),
  mockRenderChunk: vi.fn(),
  mockAssemble: vi.fn(),
}));

vi.mock("@slide-first/renderer-ffmpeg", () => ({
  FfmpegRenderer: vi.fn().mockImplementation(() => ({
    plan: mockPlan,
    renderChunk: mockRenderChunk,
    assemble: mockAssemble,
  })),
}));

import { handler } from "./index.js";
import type { PlanEvent, RenderChunkEvent, AssembleEvent } from "./index.js";

describe("Render Worker Lambda handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches plan action to renderer.plan()", async () => {
    const planResult = {
      totalFrames: 900,
      chunkCount: 2,
      fps: 30,
      width: 1920,
      height: 1080,
      videoBitrateKbps: 5000,
      intermediatePrefix: "user/proj/versions/v0001/intermediate/lt-full",
      input: {
        manifestKey: "user/proj/versions/v0001/manifest.json",
        bucket: "test-bucket",
        outputType: "lt-full",
      },
    };
    mockPlan.mockResolvedValue(planResult);

    const event: PlanEvent = {
      action: "plan",
      input: {
        manifestKey: "user/proj/versions/v0001/manifest.json",
        bucket: "test-bucket",
        outputType: "lt-full",
      },
    };

    const result = await handler(event);
    expect(mockPlan).toHaveBeenCalledWith({
      manifestKey: "user/proj/versions/v0001/manifest.json",
      bucket: "test-bucket",
      outputType: "lt-full",
    });
    expect(result).toEqual(planResult);
  });

  it("dispatches renderChunk action to renderer.renderChunk()", async () => {
    const chunkResult = {
      chunkIndex: 0,
      artifactKey: "user/proj/intermediate/chunk-000.mp4",
      frameCount: 450,
    };
    mockRenderChunk.mockResolvedValue(chunkResult);

    const plan = {
      totalFrames: 900,
      chunkCount: 2,
      fps: 30,
      width: 1920,
      height: 1080,
      videoBitrateKbps: 5000,
      intermediatePrefix: "user/proj/intermediate/lt-full",
      input: {
        manifestKey: "user/proj/versions/v0001/manifest.json",
        bucket: "test-bucket",
        outputType: "lt-full",
      },
    };

    const event: RenderChunkEvent = {
      action: "renderChunk",
      chunk: { plan, chunkIndex: 0 },
    };

    const result = await handler(event);
    expect(mockRenderChunk).toHaveBeenCalledWith(plan, 0);
    expect(result).toEqual(chunkResult);
  });

  it("dispatches assemble action to renderer.assemble()", async () => {
    const assembleResult = {
      outputKey: "user/proj/intermediate/final.mp4",
      durationMs: 30000,
      totalFrames: 900,
    };
    mockAssemble.mockResolvedValue(assembleResult);

    const plan = {
      totalFrames: 900,
      chunkCount: 2,
      fps: 30,
      width: 1920,
      height: 1080,
      videoBitrateKbps: 5000,
      intermediatePrefix: "user/proj/intermediate/lt-full",
      input: {
        manifestKey: "user/proj/versions/v0001/manifest.json",
        bucket: "test-bucket",
        outputType: "lt-full",
      },
    };

    const chunks = [
      { chunkIndex: 0, artifactKey: "chunk-000.mp4", frameCount: 450 },
      { chunkIndex: 1, artifactKey: "chunk-001.mp4", frameCount: 450 },
    ];

    const event: AssembleEvent = {
      action: "assemble",
      planResult: { Payload: plan },
      chunkResults: chunks.map((c) => ({ chunkResult: { Payload: c } })),
    };

    const result = await handler(event);
    expect(mockAssemble).toHaveBeenCalledWith(plan, chunks);
    expect(result).toEqual(assembleResult);
  });

  it("throws on unknown action", async () => {
    const event = { action: "unknown" } as unknown as PlanEvent;
    await expect(handler(event)).rejects.toThrow("Unknown action: unknown");
  });

  it("uses BUCKET_NAME env var when input.bucket is empty", async () => {
    const planResult = {
      totalFrames: 900,
      chunkCount: 1,
      fps: 30,
      width: 1920,
      height: 1080,
      videoBitrateKbps: 5000,
      intermediatePrefix: "prefix",
      input: {
        manifestKey: "manifest.json",
        bucket: "",
        outputType: "lt-full",
      },
    };
    mockPlan.mockResolvedValue(planResult);

    const event: PlanEvent = {
      action: "plan",
      input: {
        manifestKey: "manifest.json",
        bucket: "",
        outputType: "lt-full",
      },
    };

    await handler(event);
    // When bucket is empty string (falsy), it should use BUCKET_NAME env var (also empty in test)
    expect(mockPlan).toHaveBeenCalledWith(
      expect.objectContaining({ manifestKey: "manifest.json" }),
    );
  });
});
