import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process
vi.mock("node:child_process", () => ({
  execFile: vi.fn((...args: unknown[]) => {
    const cb = args[args.length - 1];
    if (typeof cb === "function") {
      const cmd = args[0] as string;
      if (cmd === "ffprobe") {
        (cb as Function)(null, { stdout: "5.432\n", stderr: "" });
      } else {
        (cb as Function)(null, { stdout: "", stderr: "" });
      }
    }
    return {};
  }),
}));

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

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

import { execFile } from "node:child_process";
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
    { pageNumber: 1, imageKey: "pages/page-001.png", script: { mode: "plain", text: "AWSについて" }, audioKey: "audio/page-001.mp3", audioDurationSec: 0, clipKey: "clips/page-001.mp4" },
    { pageNumber: 2, imageKey: "pages/page-002.png", script: { mode: "plain", text: "まとめ" }, audioKey: "audio/page-002.mp3", audioDurationSec: 0, clipKey: "clips/page-002.mp4" },
  ],
  stages: { pages: "done", audio: "pending", captions: "pending", clips: "pending", concat: "pending" },
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

    mockPollySend.mockResolvedValue({
      AudioStream: Buffer.from("fake-mp3-data"),
      RequestCharacters: 42,
    });
  });

  it("calls Polly SynthesizeSpeech with correct parameters", async () => {
    const { handler } = await import("./index.js");
    const result = await handler({ s3Bucket: "test-bucket", s3Prefix: "users/user-1/projects/proj-1/", projectId: "proj-1", userId: "user-1", renderId: "render-1" });

    expect(result.success).toBe(true);
    expect(mockPollySend).toHaveBeenCalledTimes(2); // 2 pages

    const firstCall = mockPollySend.mock.calls[0][0];
    expect(firstCall.input.OutputFormat).toBe("mp3");
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

  it("measures duration with ffprobe", async () => {
    const { handler } = await import("./index.js");
    await handler({ s3Bucket: "test-bucket", s3Prefix: "users/user-1/projects/proj-1/", projectId: "proj-1", userId: "user-1", renderId: "render-1" });

    const mockExecFile = vi.mocked(execFile);
    // Should call ffprobe for each page
    const ffprobeCalls = mockExecFile.mock.calls.filter((call) => call[0] === "ffprobe");
    expect(ffprobeCalls.length).toBe(2);

    // Verify ffprobe args
    const probeArgs = ffprobeCalls[0][1] as string[];
    expect(probeArgs).toContain("-v");
    expect(probeArgs).toContain("error");
    expect(probeArgs).toContain("-show_entries");
    expect(probeArgs).toContain("format=duration");
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
        { pageNumber: 1, imageKey: "pages/page-001.png", script: { mode: "plain" as const, text: "A & B < C" }, audioKey: "audio/page-001.mp3", audioDurationSec: 0, clipKey: "clips/page-001.mp4" },
      ],
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
