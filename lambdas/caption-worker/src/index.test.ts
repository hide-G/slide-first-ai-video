import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock AWS SDK
vi.mock("@aws-sdk/client-s3", () => {
  const mockSend = vi.fn();
  return {
    S3Client: vi.fn(() => ({ send: mockSend })),
    GetObjectCommand: vi.fn((input: unknown) => ({ type: "get", input })),
    PutObjectCommand: vi.fn((input: unknown) => ({ type: "put", input })),
    __mockSend: mockSend,
  };
});

import type { Manifest } from "@slide-first/shared-types";

const { __mockSend: mockSend } = await import("@aws-sdk/client-s3") as unknown as { __mockSend: ReturnType<typeof vi.fn> };

const sampleManifest: Manifest = {
  schemaVersion: 1,
  projectId: "proj-1",
  userId: "user-1",
  contentLanguage: "ja-JP",
  source: {
    kind: "uploaded",
    fileKey: "users/user-1/projects/proj-1/input/source.pdf",
    pageCount: 3,
  },
  voice: { id: "Takumi", engine: "neural", languageCode: "ja-JP", sampleRate: "24000" },
  output: {
    aspect: "16:9",
    width: 1920,
    height: 1080,
    fps: 30,
    captions: "burn",
    verticalLayout: null,
    padColor: null,
  },
  lexicon: [],
  pages: [
    { pageNumber: 1, imageKey: "pages/page-001.png", script: { mode: "plain", text: "First page text" }, audioKey: "audio/page-001.wav", audioDurationSec: 3.5, frameAlignedDurationMs: 3534 },
    { pageNumber: 2, imageKey: "pages/page-002.png", script: { mode: "plain", text: "Second page text" }, audioKey: "audio/page-002.wav", audioDurationSec: 4.2, frameAlignedDurationMs: 4200 },
    { pageNumber: 3, imageKey: "pages/page-003.png", script: { mode: "plain", text: "Third page text" }, audioKey: "audio/page-003.wav", audioDurationSec: 2.8, frameAlignedDurationMs: 2800 },
  ],
  stages: { pages: "done", audio: "done", captions: "pending", video: "pending" },
};

describe("Stage 3: Captions handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSend.mockImplementation((cmd: { type: string }) => {
      if (cmd.type === "get") {
        return Promise.resolve({
          Body: { transformToString: () => Promise.resolve(JSON.stringify(sampleManifest)) },
        });
      }
      return Promise.resolve({});
    });
  });

  it("generates SRT with correct subtitle count", async () => {
    const { handler } = await import("./index.js");
    const result = await handler({
      s3Bucket: "test-bucket",
      s3Prefix: "users/user-1/projects/proj-1/",
      projectId: "proj-1",
      userId: "user-1",
      renderId: "render-1",
      stage: "captions",
    });

    expect(result.success).toBe(true);
    expect(result.subtitleCount).toBe(3);
    expect(result.totalDuration).toBeCloseTo(10.5); // 3.5 + 4.2 + 2.8
  });

  it("uploads SRT to correct S3 key", async () => {
    const { handler } = await import("./index.js");
    await handler({
      s3Bucket: "test-bucket",
      s3Prefix: "users/user-1/projects/proj-1/",
      projectId: "proj-1",
      userId: "user-1",
      renderId: "render-1",
      stage: "captions",
    });

    const putCalls = mockSend.mock.calls.filter(
      (call: unknown[]) => (call[0] as { type: string }).type === "put",
    );
    // Find the SRT upload (not manifest writes)
    const srtPut = putCalls.find(
      (call: unknown[]) => (call[0] as { input: { ContentType?: string } }).input.ContentType === "text/plain; charset=utf-8",
    );
    expect(srtPut).toBeDefined();
    const srtInput = (srtPut![0] as { input: { Key: string; Body: string } }).input;
    expect(srtInput.Key).toBe("users/user-1/projects/proj-1/captions/captions.srt");
    // Verify SRT content structure
    expect(srtInput.Body).toContain("-->");
    expect(srtInput.Body).toContain("First page text");
  });

  it("generates monotonically increasing timestamps", async () => {
    const { handler } = await import("./index.js");
    await handler({
      s3Bucket: "test-bucket",
      s3Prefix: "users/user-1/projects/proj-1/",
      projectId: "proj-1",
      userId: "user-1",
      renderId: "render-1",
      stage: "captions",
    });

    const putCalls = mockSend.mock.calls.filter(
      (call: unknown[]) => (call[0] as { type: string }).type === "put",
    );
    const srtPut = putCalls.find(
      (call: unknown[]) => (call[0] as { input: { ContentType?: string } }).input.ContentType === "text/plain; charset=utf-8",
    );
    const srtContent = (srtPut![0] as { input: { Body: string } }).input.Body;

    // Extract timestamps
    const timestamps = srtContent.match(/\d{2}:\d{2}:\d{2},\d{3}/g);
    expect(timestamps).not.toBeNull();
    // Each pair should be monotonically increasing
    for (let i = 1; i < timestamps!.length; i++) {
      expect(timestamps![i] >= timestamps![i - 1]).toBe(true);
    }
  });

  it("fails if audioDurationSec is 0 for any page", async () => {
    const badManifest = {
      ...sampleManifest,
      pages: [
        ...sampleManifest.pages.slice(0, 2),
        { ...sampleManifest.pages[2], audioDurationSec: 0 },
      ],
    };
    mockSend.mockImplementation((cmd: { type: string }) => {
      if (cmd.type === "get") {
        return Promise.resolve({
          Body: { transformToString: () => Promise.resolve(JSON.stringify(badManifest)) },
        });
      }
      return Promise.resolve({});
    });

    const { handler } = await import("./index.js");
    const result = await handler({
      s3Bucket: "test-bucket",
      s3Prefix: "users/user-1/projects/proj-1/",
      projectId: "proj-1",
      userId: "user-1",
      renderId: "render-1",
      stage: "captions",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("no measured audioDurationSec");
  });

  it("sets stage to done on success", async () => {
    const { handler } = await import("./index.js");
    await handler({
      s3Bucket: "test-bucket",
      s3Prefix: "users/user-1/projects/proj-1/",
      projectId: "proj-1",
      userId: "user-1",
      renderId: "render-1",
      stage: "captions",
    });

    const putCalls = mockSend.mock.calls.filter(
      (call: unknown[]) => (call[0] as { type: string }).type === "put",
    );
    const manifestPuts = putCalls.filter(
      (call: unknown[]) => (call[0] as { input: { ContentType?: string } }).input.ContentType === "application/json",
    );
    const lastManifest = JSON.parse((manifestPuts[manifestPuts.length - 1][0] as { input: { Body: string } }).input.Body);
    expect(lastManifest.stages.captions).toBe("done");
  });
});
