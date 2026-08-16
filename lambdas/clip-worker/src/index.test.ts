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
  readFile: vi.fn().mockResolvedValue(Buffer.from("fake-mp4-data")),
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
  lexicon: [],
  pages: [
    { pageNumber: 1, imageKey: "users/user-1/projects/proj-1/pages/page-001.png", script: { mode: "plain", text: "Hello" }, audioKey: "users/user-1/projects/proj-1/audio/page-001.mp3", audioDurationSec: 5.432, clipKey: "users/user-1/projects/proj-1/clips/page-001.mp4" },
    { pageNumber: 2, imageKey: "users/user-1/projects/proj-1/pages/page-002.png", script: { mode: "plain", text: "World" }, audioKey: "users/user-1/projects/proj-1/audio/page-002.mp3", audioDurationSec: 5.432, clipKey: "users/user-1/projects/proj-1/clips/page-002.mp4" },
  ],
  stages: { pages: "done", audio: "done", captions: "done", clips: "pending", concat: "pending" },
};

describe("Stage 4: Clips handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSend.mockImplementation((cmd: { type: string; input?: { Key?: string } }) => {
      if (cmd.type === "get") {
        if (cmd.input?.Key?.endsWith("manifest.json")) {
          return Promise.resolve({
            Body: { transformToString: () => Promise.resolve(JSON.stringify(sampleManifest)) },
          });
        }
        // PNG or MP3 download
        return Promise.resolve({
          Body: { transformToByteArray: () => Promise.resolve(new Uint8Array([0x00])) },
        });
      }
      return Promise.resolve({});
    });
  });

  it("calls ffmpeg with correct clip args including -t", async () => {
    const { handler } = await import("./index.js");
    const result = await handler({
      s3Bucket: "test-bucket",
      s3Prefix: "users/user-1/projects/proj-1/",
      projectId: "proj-1",
      userId: "user-1",
      renderId: "render-1",
      stage: "clips",
    });

    expect(result.success).toBe(true);
    expect(result.clipCount).toBe(2);

    const mockExecFile = vi.mocked(execFile);
    const ffmpegCalls = mockExecFile.mock.calls.filter((call) => call[0] === "ffmpeg");
    expect(ffmpegCalls.length).toBe(2);

    // Check first clip args
    const firstArgs = ffmpegCalls[0][1] as string[];
    // Must have -t with measured duration
    expect(firstArgs).toContain("-t");
    expect(firstArgs[firstArgs.indexOf("-t") + 1]).toBe("5.432");
    // Must use -loop 1
    expect(firstArgs).toContain("-loop");
    // Must use libx264
    expect(firstArgs).toContain("libx264");
    // Must use -tune stillimage
    expect(firstArgs).toContain("stillimage");
    // Must use AAC 96k
    expect(firstArgs).toContain("aac");
    expect(firstArgs).toContain("96k");
    // Must have yuv420p
    expect(firstArgs).toContain("yuv420p");
  });

  it("validates clip duration with ffprobe", async () => {
    const { handler } = await import("./index.js");
    await handler({
      s3Bucket: "test-bucket",
      s3Prefix: "users/user-1/projects/proj-1/",
      projectId: "proj-1",
      userId: "user-1",
      renderId: "render-1",
      stage: "clips",
    });

    const mockExecFile = vi.mocked(execFile);
    const ffprobeCalls = mockExecFile.mock.calls.filter((call) => call[0] === "ffprobe");
    expect(ffprobeCalls.length).toBe(2);
  });

  it("fails on duration drift beyond tolerance", async () => {
    const mockExecFile = vi.mocked(execFile);
    mockExecFile.mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1];
      if (typeof cb === "function") {
        const cmd = args[0] as string;
        if (cmd === "ffprobe") {
          (cb as Function)(null, { stdout: "6.0\n", stderr: "" });
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
      renderId: "render-1",
      stage: "clips",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("duration drift too large");
  });

  it("does not use shell option in execFile", async () => {
    const { handler } = await import("./index.js");
    await handler({
      s3Bucket: "test-bucket",
      s3Prefix: "users/user-1/projects/proj-1/",
      projectId: "proj-1",
      userId: "user-1",
      renderId: "render-1",
      stage: "clips",
    });

    const mockExecFile = vi.mocked(execFile);
    for (const call of mockExecFile.mock.calls) {
      // Third argument (options) should not have shell: true
      const opts = call[2] as Record<string, unknown> | undefined;
      if (opts && typeof opts === "object") {
        expect(opts).not.toHaveProperty("shell", true);
      }
    }
  });

  it("does not embed text in ffmpeg command args", async () => {
    const { handler } = await import("./index.js");
    await handler({
      s3Bucket: "test-bucket",
      s3Prefix: "users/user-1/projects/proj-1/",
      projectId: "proj-1",
      userId: "user-1",
      renderId: "render-1",
      stage: "clips",
    });

    const mockExecFile = vi.mocked(execFile);
    const ffmpegCalls = mockExecFile.mock.calls.filter((call) => call[0] === "ffmpeg");
    for (const call of ffmpegCalls) {
      const args = call[1] as string[];
      // No drawtext usage
      for (const arg of args) {
        expect(arg).not.toContain("drawtext");
        expect(arg).not.toContain("text=");
      }
    }
  });
});
