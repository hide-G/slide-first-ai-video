import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process
vi.mock("node:child_process", () => ({
  execFile: vi.fn((...args: unknown[]) => {
    // promisify calls execFile(cmd, args, cb) or execFile(cmd, args, opts, cb)
    const cb = args[args.length - 1];
    if (typeof cb === "function") {
      (cb as Function)(null, { stdout: "", stderr: "" });
    }
    return {};
  }),
}));

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
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
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import type { Manifest } from "@slide-first/shared-types";

// Access mock send
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
    { pageNumber: 1, imageKey: "pages/page-001.png", script: { mode: "plain", text: "Hello" }, audioKey: "audio/page-001.mp3", audioDurationSec: 0, clipKey: "clips/page-001.mp4" },
    { pageNumber: 2, imageKey: "pages/page-002.png", script: { mode: "plain", text: "World" }, audioKey: "audio/page-002.mp3", audioDurationSec: 0, clipKey: "clips/page-002.mp4" },
    { pageNumber: 3, imageKey: "pages/page-003.png", script: { mode: "plain", text: "End" }, audioKey: "audio/page-003.mp3", audioDurationSec: 0, clipKey: "clips/page-003.mp4" },
  ],
  stages: { pages: "pending", audio: "pending", captions: "pending", clips: "pending", concat: "pending" },
};

describe("Stage 1: Pages handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup S3 mocks
    mockSend.mockImplementation((cmd: { type: string; input?: { Key?: string } }) => {
      if (cmd.type === "get") {
        if (cmd.input?.Key?.endsWith("manifest.json")) {
          return Promise.resolve({
            Body: { transformToString: () => Promise.resolve(JSON.stringify(sampleManifest)) },
          });
        }
        // PDF download
        return Promise.resolve({
          Body: { transformToByteArray: () => Promise.resolve(new Uint8Array([0x25, 0x50, 0x44, 0x46])) },
        });
      }
      // PutObject
      return Promise.resolve({});
    });

    // Setup fs mocks
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(readdir).mockResolvedValue([
      "page-001.png" as unknown as import("node:fs").Dirent,
      "page-002.png" as unknown as import("node:fs").Dirent,
      "page-003.png" as unknown as import("node:fs").Dirent,
    ]);
    vi.mocked(readFile).mockResolvedValue(Buffer.from("fake-png-data"));
  });

  it("calls pdftoppm with correct args (no shell)", async () => {
    const { handler } = await import("./index.js");
    await handler({ bucket: "test-bucket", manifestKey: "users/user-1/projects/proj-1/manifest.json" });

    const mockExecFile = vi.mocked(execFile);
    // Should have been called with pdftoppm
    const pdftoppmCall = mockExecFile.mock.calls.find((call) => call[0] === "pdftoppm");
    expect(pdftoppmCall).toBeDefined();
    expect(pdftoppmCall![1]).toContain("-png");
    expect(pdftoppmCall![1]).toContain("-r");
    expect(pdftoppmCall![1]).toContain("300");
  });

  it("uploads correct number of PNGs to S3", async () => {
    const { handler } = await import("./index.js");
    const result = await handler({ bucket: "test-bucket", manifestKey: "users/user-1/projects/proj-1/manifest.json" });

    expect(result.success).toBe(true);
    expect(result.pageCount).toBe(3);

    // Count PutObject calls (manifest writes + PNG uploads)
    const putCalls = mockSend.mock.calls.filter(
      (call: unknown[]) => (call[0] as { type: string }).type === "put",
    );
    // 2 manifest updates (running + done) + 3 PNGs = 5
    expect(putCalls.length).toBe(5);
  });

  it("sets stage to failed on error", async () => {
    vi.mocked(readdir).mockResolvedValue([
      "page-001.png" as unknown as import("node:fs").Dirent,
    ]); // Only 1 PNG, but expect 3

    const { handler } = await import("./index.js");
    const result = await handler({ bucket: "test-bucket", manifestKey: "users/user-1/projects/proj-1/manifest.json" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("PNG count mismatch");

    // Should have written manifest with stages.pages = "failed"
    const putCalls = mockSend.mock.calls.filter(
      (call: unknown[]) => (call[0] as { type: string }).type === "put",
    );
    const lastPutInput = putCalls[putCalls.length - 1][0] as { input: { Body: string } };
    const finalManifest = JSON.parse(lastPutInput.input.Body);
    expect(finalManifest.stages.pages).toBe("failed");
  });
});
