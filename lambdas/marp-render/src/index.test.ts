import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process for marp commands
vi.mock("node:child_process", () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, callback?: (err: Error | null, stdout: string, stderr: string) => void) => {
    if (callback) {
      callback(null, "", "");
    }
    return {};
  }),
}));

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from("mock-file-content")),
  readdir: vi.fn().mockResolvedValue(["deck.001.png", "deck.002.png", "deck.003.png"]),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Mock AWS SDK
vi.mock("@aws-sdk/client-s3", () => {
  const mockSend = vi.fn().mockResolvedValue({});
  return {
    S3Client: vi.fn(() => ({ send: mockSend })),
    PutObjectCommand: vi.fn((input) => ({ input })),
    __mockSend: mockSend,
  };
});

// Mock marp-commands
vi.mock("./marp-commands.js", () => ({
  generatePdf: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }),
  generatePptx: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }),
  generatePng: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }),
}));

import type { MarpRenderEvent } from "./index.js";

describe("Marp render handler", () => {
  let handler: (event: MarpRenderEvent) => Promise<unknown>;
  let s3MockSend: ReturnType<typeof vi.fn>;
  let mockGeneratePdf: ReturnType<typeof vi.fn>;
  let mockGeneratePptx: ReturnType<typeof vi.fn>;
  let mockGeneratePng: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const s3Module = await import("@aws-sdk/client-s3");
    s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;

    const marpModule = await import("./marp-commands.js");
    mockGeneratePdf = marpModule.generatePdf as ReturnType<typeof vi.fn>;
    mockGeneratePptx = marpModule.generatePptx as ReturnType<typeof vi.fn>;
    mockGeneratePng = marpModule.generatePng as ReturnType<typeof vi.fn>;

    const module = await import("./index.js");
    handler = module.handler;
  });

  const baseEvent: MarpRenderEvent = {
    projectId: "proj-123",
    userId: "user-456",
    version: 1,
    deckMarkdown: "---\nmarp: true\n---\n# Slide 1\n---\n# Slide 2",
    s3Bucket: "test-bucket",
    s3Prefix: "user-456/proj-123/versions/v0001/",
    outputs: ["pdf", "pptx", "png"],
  };

  it("generates PDF when requested", async () => {
    const event = { ...baseEvent, outputs: ["pdf"] as MarpRenderEvent["outputs"] };
    const result = await handler(event) as { pdfKey?: string };

    expect(mockGeneratePdf).toHaveBeenCalledWith("deck.md", "/tmp/marp-work");
    expect(result.pdfKey).toBe("user-456/proj-123/versions/v0001/deck.pdf");
  });

  it("generates PPTX when requested", async () => {
    const event = { ...baseEvent, outputs: ["pptx"] as MarpRenderEvent["outputs"] };
    const result = await handler(event) as { pptxKey?: string };

    expect(mockGeneratePptx).toHaveBeenCalledWith("deck.md", "/tmp/marp-work");
    expect(result.pptxKey).toBe("user-456/proj-123/versions/v0001/deck.pptx");
  });

  it("generates PNG images when requested", async () => {
    const event = { ...baseEvent, outputs: ["png"] as MarpRenderEvent["outputs"] };
    const result = await handler(event) as { slideImageKeys: string[] };

    expect(mockGeneratePng).toHaveBeenCalledWith("deck.md", "/tmp/marp-work");
    expect(result.slideImageKeys).toEqual([
      "user-456/proj-123/versions/v0001/slides/deck.001.png",
      "user-456/proj-123/versions/v0001/slides/deck.002.png",
      "user-456/proj-123/versions/v0001/slides/deck.003.png",
    ]);
  });

  it("handles all output formats together", async () => {
    const result = await handler(baseEvent) as {
      pdfKey?: string;
      pptxKey?: string;
      slideImageKeys: string[];
    };

    expect(mockGeneratePdf).toHaveBeenCalled();
    expect(mockGeneratePptx).toHaveBeenCalled();
    expect(mockGeneratePng).toHaveBeenCalled();
    expect(result.pdfKey).toBeDefined();
    expect(result.pptxKey).toBeDefined();
    expect(result.slideImageKeys).toHaveLength(3);
  });

  it("uploads files to S3 with correct content types", async () => {
    const event = { ...baseEvent, outputs: ["pdf"] as MarpRenderEvent["outputs"] };
    await handler(event);

    expect(s3MockSend).toHaveBeenCalled();
    const uploadCall = s3MockSend.mock.calls[0][0];
    expect(uploadCall.input.Bucket).toBe("test-bucket");
    expect(uploadCall.input.ContentType).toBe("application/pdf");
  });

  it("writes deck markdown to /tmp work directory", async () => {
    const { writeFile } = await import("node:fs/promises");
    const event = { ...baseEvent, outputs: ["pdf"] as MarpRenderEvent["outputs"] };
    await handler(event);

    expect(writeFile).toHaveBeenCalledWith(
      "/tmp/marp-work/deck.md",
      baseEvent.deckMarkdown,
      "utf-8",
    );
  });
});
