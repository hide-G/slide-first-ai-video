import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock AWS SDK - Polly
vi.mock("@aws-sdk/client-polly", () => {
  const mockSend = vi.fn();
  return {
    PollyClient: vi.fn(() => ({ send: mockSend })),
    SynthesizeSpeechCommand: vi.fn((input: unknown) => ({ type: "polly", input })),
    __mockSend: mockSend,
  };
});

// Mock AWS SDK - S3
vi.mock("@aws-sdk/client-s3", () => {
  const mockSend = vi.fn();
  return {
    S3Client: vi.fn(() => ({ send: mockSend })),
    GetObjectCommand: vi.fn((input: unknown) => ({ type: "get", input })),
    PutObjectCommand: vi.fn((input: unknown) => ({ type: "put", input })),
    HeadObjectCommand: vi.fn((input: unknown) => ({ type: "head", input })),
    __mockSend: mockSend,
  };
});

import type { Manifest } from "@slide-first/shared-types";

const { __mockSend: mockS3Send } = await import("@aws-sdk/client-s3") as unknown as { __mockSend: ReturnType<typeof vi.fn> };
const { __mockSend: mockPollySend } = await import("@aws-sdk/client-polly") as unknown as { __mockSend: ReturnType<typeof vi.fn> };

const sampleManifest: Manifest = {
  schemaVersion: 1,
  projectId: "proj-1",
  userId: "user-1",
  contentLanguage: "ja-JP",
  source: {
    kind: "uploaded",
    fileKey: "users/user-1/projects/proj-1/input/source.pdf",
    pageCount: 2,
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
  lexicon: [
    { written: "AWS", reading: "エーダブリューエス", method: "sub" },
  ],
  pages: [
    { pageNumber: 1, imageKey: "pages/page-001.png", script: { mode: "plain", text: "AWSについて" }, audioKey: "audio/page-001.wav", audioDurationSec: 0, frameAlignedDurationMs: 0 },
    { pageNumber: 2, imageKey: "pages/page-002.png", script: { mode: "plain", text: "まとめ" }, audioKey: "audio/page-002.wav", audioDurationSec: 0, frameAlignedDurationMs: 0 },
  ],
  stages: { pages: "done", audio: "pending", captions: "pending", video: "pending" },
};

describe("Stage 2: Audio handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockS3Send.mockImplementation((cmd: { type: string; input?: { Key?: string } }) => {
      if (cmd.type === "get") {
        return Promise.resolve({
          Body: { transformToString: () => Promise.resolve(JSON.stringify(sampleManifest)) },
        });
      }
      if (cmd.type === "head") {
        return Promise.reject(new Error("NotFound"));
      }
      return Promise.resolve({});
    });

    // Return a fake PCM buffer (48000 bytes = 1 second at 24000Hz, 16bit, mono)
    mockPollySend.mockResolvedValue({
      AudioStream: Buffer.alloc(48000),
      RequestCharacters: 42,
    });
  });

  it("calls Polly SynthesizeSpeech with pcm format", async () => {
    const { handler } = await import("./index.js");
    const result = await handler({ s3Bucket: "test-bucket", s3Prefix: "users/user-1/projects/proj-1/", projectId: "proj-1", userId: "user-1", renderId: "render-1" });

    expect(result.success).toBe(true);
    expect(mockPollySend).toHaveBeenCalledTimes(2); // 2 pages

    const firstCall = mockPollySend.mock.calls[0][0];
    expect(firstCall.input.OutputFormat).toBe("pcm");
    expect(firstCall.input.VoiceId).toBe("Takumi");
    expect(firstCall.input.Engine).toBe("neural");
    expect(firstCall.input.SampleRate).toBe("24000");
    expect(firstCall.input.LanguageCode).toBe("ja-JP");
    expect(firstCall.input.TextType).toBe("ssml");
    // Should be wrapped in <speak> tags
    expect(firstCall.input.Text).toContain("<speak>");
    expect(firstCall.input.Text).toContain("</speak>");
  });

  it("applies lexicon substitutions", async () => {
    const { handler } = await import("./index.js");
    await handler({ s3Bucket: "test-bucket", s3Prefix: "users/user-1/projects/proj-1/", projectId: "proj-1", userId: "user-1", renderId: "render-1" });

    const firstCall = mockPollySend.mock.calls[0][0];
    // AWS should be replaced with sub alias
    expect(firstCall.input.Text).toContain("<sub alias=");
    expect(firstCall.input.Text).toContain("エーダブリューエス");
  });

  it("calculates audioDurationSec from PCM byte length", async () => {
    // 48000 bytes / (2 * 24000) = 1.0 second
    const { handler } = await import("./index.js");
    await handler({ s3Bucket: "test-bucket", s3Prefix: "users/user-1/projects/proj-1/", projectId: "proj-1", userId: "user-1", renderId: "render-1" });

    // Check manifest written to S3 contains correct duration
    const putCalls = mockS3Send.mock.calls.filter(
      (call: unknown[]) => (call[0] as { type: string }).type === "put",
    );
    const manifestPuts = putCalls.filter(
      (call: unknown[]) => (call[0] as { input: { ContentType?: string } }).input.ContentType === "application/json",
    );
    const lastManifest = JSON.parse((manifestPuts[manifestPuts.length - 1][0] as { input: { Body: string } }).input.Body);
    // Each page should have audioDurationSec = 1.0
    expect(lastManifest.pages[0].audioDurationSec).toBe(1.0);
    expect(lastManifest.pages[1].audioDurationSec).toBe(1.0);
  });

  it("computes frameAlignedDurationMs", async () => {
    const { handler } = await import("./index.js");
    await handler({ s3Bucket: "test-bucket", s3Prefix: "users/user-1/projects/proj-1/", projectId: "proj-1", userId: "user-1", renderId: "render-1" });

    const putCalls = mockS3Send.mock.calls.filter(
      (call: unknown[]) => (call[0] as { type: string }).type === "put",
    );
    const manifestPuts = putCalls.filter(
      (call: unknown[]) => (call[0] as { input: { ContentType?: string } }).input.ContentType === "application/json",
    );
    const lastManifest = JSON.parse((manifestPuts[manifestPuts.length - 1][0] as { input: { Body: string } }).input.Body);
    // audioDurationSec = 1.0 -> 1000ms, at 30fps frameMs=33.333, ceil(1000/33.333)=30 frames, 30*33.333=1000ms rounded=1000
    expect(lastManifest.pages[0].frameAlignedDurationMs).toBe(1000);
  });

  it("uploads WAV with correct content type", async () => {
    const { handler } = await import("./index.js");
    await handler({ s3Bucket: "test-bucket", s3Prefix: "users/user-1/projects/proj-1/", projectId: "proj-1", userId: "user-1", renderId: "render-1" });

    const putCalls = mockS3Send.mock.calls.filter(
      (call: unknown[]) => (call[0] as { type: string }).type === "put",
    );
    const wavPut = putCalls.find(
      (call: unknown[]) => (call[0] as { input: { ContentType?: string } }).input.ContentType === "audio/wav",
    );
    expect(wavPut).toBeDefined();
    // WAV file should start with RIFF header (44 bytes header + PCM data)
    const body = (wavPut![0] as { input: { Body: Buffer } }).input.Body;
    expect(body.length).toBe(48000 + 44); // PCM data + WAV header
    expect(body.slice(0, 4).toString()).toBe("RIFF");
  });

  it("records total RequestCharacters", async () => {
    const { handler } = await import("./index.js");
    const result = await handler({ s3Bucket: "test-bucket", s3Prefix: "users/user-1/projects/proj-1/", projectId: "proj-1", userId: "user-1", renderId: "render-1" });

    expect(result.totalCharacters).toBe(84); // 42 * 2 pages
  });

  it("sets stage to failed on error", async () => {
    mockPollySend.mockRejectedValue(new Error("Polly throttled"));

    const { handler } = await import("./index.js");
    const result = await handler({ s3Bucket: "test-bucket", s3Prefix: "users/user-1/projects/proj-1/", projectId: "proj-1", userId: "user-1", renderId: "render-1" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Polly throttled");

    // Should write manifest with failed status
    const putCalls = mockS3Send.mock.calls.filter(
      (call: unknown[]) => (call[0] as { type: string }).type === "put",
    );
    const lastPut = putCalls[putCalls.length - 1][0] as { input: { Body: string } };
    const finalManifest = JSON.parse(lastPut.input.Body);
    expect(finalManifest.stages.audio).toBe("failed");
  });

  it("XML-escapes plain text before SSML wrapping", async () => {
    // Override manifest with text containing XML special characters
    const specialManifest = {
      ...sampleManifest,
      lexicon: [],
      pages: [
        { pageNumber: 1, imageKey: "pages/page-001.png", script: { mode: "plain" as const, text: "A & B < C" }, audioKey: "audio/page-001.wav", audioDurationSec: 0, frameAlignedDurationMs: 0 },
      ],
      source: { ...sampleManifest.source, pageCount: 1 },
    };
    mockS3Send.mockImplementation((cmd: { type: string; input?: { Key?: string } }) => {
      if (cmd.type === "get") {
        return Promise.resolve({
          Body: { transformToString: () => Promise.resolve(JSON.stringify(specialManifest)) },
        });
      }
      if (cmd.type === "head") {
        return Promise.reject(new Error("NotFound"));
      }
      return Promise.resolve({});
    });

    const { handler } = await import("./index.js");
    await handler({ s3Bucket: "test-bucket", s3Prefix: "users/user-1/projects/proj-1/", projectId: "proj-1", userId: "user-1", renderId: "render-1" });

    const firstCall = mockPollySend.mock.calls[0][0];
    // Should contain escaped XML entities, not raw & or <
    expect(firstCall.input.Text).toContain("&amp;");
    expect(firstCall.input.Text).toContain("&lt;");
    expect(firstCall.input.Text).not.toMatch(/A & B/);
    expect(firstCall.input.Text).toContain("<speak>");
  });
});
