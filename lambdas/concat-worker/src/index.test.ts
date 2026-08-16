import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process
vi.mock("node:child_process", () => ({
  execFile: vi.fn((...args: unknown[]) => {
    const cb = args[args.length - 1];
    if (typeof cb === "function") {
      const cmd = args[0] as string;
      if (cmd === "ffprobe") {
        (cb as Function)(null, { stdout: "10.500\n", stderr: "" });
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
  readFile: vi.fn().mockResolvedValue(Buffer.from("fake-video-data")),
}));

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

import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
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
    { pageNumber: 1, imageKey: "pages/page-001.png", script: { mode: "plain", text: "Page 1" }, audioKey: "audio/page-001.mp3", audioDurationSec: 3.5, clipKey: "clips/page-001.mp4" },
    { pageNumber: 2, imageKey: "pages/page-002.png", script: { mode: "plain", text: "Page 2" }, audioKey: "audio/page-002.mp3", audioDurationSec: 4.2, clipKey: "clips/page-002.mp4" },
    { pageNumber: 3, imageKey: "pages/page-003.png", script: { mode: "plain", text: "Page 3" }, audioKey: "audio/page-003.mp3", audioDurationSec: 2.8, clipKey: "clips/page-003.mp4" },
  ],
  stages: { pages: "done", audio: "done", captions: "done", clips: "done", concat: "pending" },
};

describe("Stage 5: Concat handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-establish the execFile mock implementation after clearAllMocks
    const mockExecFile = vi.mocked(execFile);
    mockExecFile.mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1];
      if (typeof cb === "function") {
        const cmd = args[0] as string;
        if (cmd === "ffprobe") {
          (cb as Function)(null, { stdout: "10.500\n", stderr: "" });
        } else {
          (cb as Function)(null, { stdout: "", stderr: "" });
        }
      }
      return {} as ReturnType<typeof execFile>;
    });

    mockSend.mockImplementation((cmd: { type: string; input?: { Key?: string } }) => {
      if (cmd.type === "get") {
        if (cmd.input?.Key?.endsWith("manifest.json")) {
          return Promise.resolve({
            Body: { transformToString: () => Promise.resolve(JSON.stringify(sampleManifest)) },
          });
        }
        // Clip or SRT download
        return Promise.resolve({
          Body: { transformToByteArray: () => Promise.resolve(new Uint8Array([0x00])) },
        });
      }
      return Promise.resolve({});
    });
  });

  it("uses subtitles filter when captions is burn", async () => {
    const { handler } = await import("./index.js");
    const result = await handler({
      s3Bucket: "test-bucket",
      s3Prefix: "users/user-1/projects/proj-1/",
      projectId: "proj-1",
      userId: "user-1",
      renderId: "render-001",
      stage: "concat",
    });

    expect(result.success).toBe(true);

    const mockExecFile = vi.mocked(execFile);
    const ffmpegCalls = mockExecFile.mock.calls.filter((call) => call[0] === "ffmpeg");
    // First call is the concat, second is decode check
    const concatArgs = ffmpegCalls[0][1] as string[];

    // Must use subtitles filter
    expect(concatArgs).toContain("-vf");
    const vfIdx = concatArgs.indexOf("-vf");
    expect(concatArgs[vfIdx + 1]).toContain("subtitles=");
    // Must NOT use drawtext
    expect(concatArgs[vfIdx + 1]).not.toContain("drawtext");
  });

  it("writes concat list file with correct format", async () => {
    const { handler } = await import("./index.js");
    await handler({
      s3Bucket: "test-bucket",
      s3Prefix: "users/user-1/projects/proj-1/",
      projectId: "proj-1",
      userId: "user-1",
      renderId: "render-001",
      stage: "concat",
    });

    const mockWriteFile = vi.mocked(writeFile);
    // Find the list.txt write
    const listWrite = mockWriteFile.mock.calls.find(
      (call) => (call[0] as string).endsWith("list.txt"),
    );
    expect(listWrite).toBeDefined();
    const listContent = listWrite![1] as string;
    expect(listContent).toContain("file '");
    expect(listContent).toContain("page-001.mp4");
    expect(listContent).toContain("page-002.mp4");
    expect(listContent).toContain("page-003.mp4");
  });

  it("runs decode check", async () => {
    const { handler } = await import("./index.js");
    await handler({
      s3Bucket: "test-bucket",
      s3Prefix: "users/user-1/projects/proj-1/",
      projectId: "proj-1",
      userId: "user-1",
      renderId: "render-001",
      stage: "concat",
    });

    const mockExecFile = vi.mocked(execFile);
    const ffmpegCalls = mockExecFile.mock.calls.filter((call) => call[0] === "ffmpeg");
    // Second ffmpeg call should be decode check
    const decodeArgs = ffmpegCalls[1][1] as string[];
    expect(decodeArgs).toContain("-f");
    expect(decodeArgs).toContain("null");
    expect(decodeArgs).toContain("-map");
  });

  it("validates total duration against expected", async () => {
    // Duration should be close to 10.5 (3.5 + 4.2 + 2.8)
    const { handler } = await import("./index.js");
    const result = await handler({
      s3Bucket: "test-bucket",
      s3Prefix: "users/user-1/projects/proj-1/",
      projectId: "proj-1",
      userId: "user-1",
      renderId: "render-001",
      stage: "concat",
    });

    expect(result.success).toBe(true);
    expect(result.totalDuration).toBeCloseTo(10.5);
  });

  it("fails on excessive duration drift", async () => {
    const mockExecFile = vi.mocked(execFile);
    mockExecFile.mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1];
      if (typeof cb === "function") {
        const cmd = args[0] as string;
        if (cmd === "ffprobe") {
          (cb as Function)(null, { stdout: "15.0\n", stderr: "" }); // way off
        } else {
          (cb as Function)(null, { stdout: "", stderr: "" });
        }
      }
      return {} as ReturnType<typeof execFile>;
    });

    const { handler } = await import("./index.js");
    const result = await handler({
      s3Bucket: "test-bucket",
      s3Prefix: "users/user-1/projects/proj-1/",
      projectId: "proj-1",
      userId: "user-1",
      renderId: "render-001",
      stage: "concat",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("duration drift too large");
  });

  it("uses -c copy when captions is none", async () => {
    const noSubsManifest = {
      ...sampleManifest,
      output: { ...sampleManifest.output, captions: "none" as const },
    };
    mockSend.mockImplementation((cmd: { type: string; input?: { Key?: string } }) => {
      if (cmd.type === "get") {
        if (cmd.input?.Key?.endsWith("manifest.json")) {
          return Promise.resolve({
            Body: { transformToString: () => Promise.resolve(JSON.stringify(noSubsManifest)) },
          });
        }
        return Promise.resolve({
          Body: { transformToByteArray: () => Promise.resolve(new Uint8Array([0x00])) },
        });
      }
      return Promise.resolve({});
    });

    const { handler } = await import("./index.js");
    await handler({
      s3Bucket: "test-bucket",
      s3Prefix: "users/user-1/projects/proj-1/",
      projectId: "proj-1",
      userId: "user-1",
      renderId: "render-001",
      stage: "concat",
    });

    const mockExecFile = vi.mocked(execFile);
    const ffmpegCalls = mockExecFile.mock.calls.filter((call) => call[0] === "ffmpeg");
    const concatArgs = ffmpegCalls[0][1] as string[];
    expect(concatArgs).toContain("-c");
    expect(concatArgs).toContain("copy");
    expect(concatArgs).not.toContain("-vf");
  });

  it("uploads to correct output key", async () => {
    const { handler } = await import("./index.js");
    const result = await handler({
      s3Bucket: "test-bucket",
      s3Prefix: "users/user-1/projects/proj-1/",
      projectId: "proj-1",
      userId: "user-1",
      renderId: "render-001",
      stage: "concat",
    });

    expect(result.outputKey).toBe("users/user-1/projects/proj-1/output/render-001/video.mp4");
  });

  it("no shell usage in any execFile call", async () => {
    const { handler } = await import("./index.js");
    await handler({
      s3Bucket: "test-bucket",
      s3Prefix: "users/user-1/projects/proj-1/",
      projectId: "proj-1",
      userId: "user-1",
      renderId: "render-001",
      stage: "concat",
    });

    const mockExecFile = vi.mocked(execFile);
    for (const call of mockExecFile.mock.calls) {
      const opts = call[2] as Record<string, unknown> | undefined;
      if (opts && typeof opts === "object") {
        expect(opts).not.toHaveProperty("shell", true);
      }
    }
  });
});
