import { describe, it, expect, vi, beforeEach } from "vitest";

// marp-commands をモック
vi.mock("./marp-commands.js", () => ({
  generatePdfBuffer: vi.fn().mockResolvedValue(Buffer.from("mock-pdf")),
  generatePptxBuffer: vi.fn().mockResolvedValue(Buffer.from("mock-pptx")),
  generatePngBuffers: vi.fn().mockResolvedValue([
    Buffer.from("png-1"),
    Buffer.from("png-2"),
    Buffer.from("png-3"),
  ]),
}));

// AWS SDK をモック
vi.mock("@aws-sdk/client-s3", () => {
  const mockSend = vi.fn().mockResolvedValue({});
  return {
    S3Client: vi.fn(() => ({ send: mockSend })),
    PutObjectCommand: vi.fn((input) => ({ input })),
    __mockSend: mockSend,
  };
});

import type { MarpRenderEvent } from "./index.js";

describe("Marp render handler", () => {
  let handler: (event: MarpRenderEvent) => Promise<unknown>;
  let s3MockSend: ReturnType<typeof vi.fn>;
  let mockGeneratePdfBuffer: ReturnType<typeof vi.fn>;
  let mockGeneratePptxBuffer: ReturnType<typeof vi.fn>;
  let mockGeneratePngBuffers: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const s3Module = await import("@aws-sdk/client-s3");
    s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;

    const marpModule = await import("./marp-commands.js");
    mockGeneratePdfBuffer = marpModule.generatePdfBuffer as ReturnType<typeof vi.fn>;
    mockGeneratePptxBuffer = marpModule.generatePptxBuffer as ReturnType<typeof vi.fn>;
    mockGeneratePngBuffers = marpModule.generatePngBuffers as ReturnType<typeof vi.fn>;

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

  it("PDF 生成のリクエストを処理する", async () => {
    const event = { ...baseEvent, outputs: ["pdf"] as MarpRenderEvent["outputs"] };
    const result = await handler(event) as { pdfKey?: string };

    expect(mockGeneratePdfBuffer).toHaveBeenCalledWith(baseEvent.deckMarkdown);
    expect(result.pdfKey).toBe("user-456/proj-123/versions/v0001/deck.pdf");
  });

  it("PPTX 生成のリクエストを処理する", async () => {
    const event = { ...baseEvent, outputs: ["pptx"] as MarpRenderEvent["outputs"] };
    const result = await handler(event) as { pptxKey?: string };

    expect(mockGeneratePptxBuffer).toHaveBeenCalledWith(baseEvent.deckMarkdown);
    expect(result.pptxKey).toBe("user-456/proj-123/versions/v0001/deck.pptx");
  });

  it("PNG 画像生成のリクエストを処理する", async () => {
    const event = { ...baseEvent, outputs: ["png"] as MarpRenderEvent["outputs"] };
    const result = await handler(event) as { slideImageKeys: string[] };

    expect(mockGeneratePngBuffers).toHaveBeenCalledWith(baseEvent.deckMarkdown);
    expect(result.slideImageKeys).toEqual([
      "user-456/proj-123/versions/v0001/slides/deck.001.png",
      "user-456/proj-123/versions/v0001/slides/deck.002.png",
      "user-456/proj-123/versions/v0001/slides/deck.003.png",
    ]);
  });

  it("全出力形式を同時に処理する", async () => {
    const result = await handler(baseEvent) as {
      pdfKey?: string;
      pptxKey?: string;
      slideImageKeys: string[];
    };

    expect(mockGeneratePdfBuffer).toHaveBeenCalled();
    expect(mockGeneratePptxBuffer).toHaveBeenCalled();
    expect(mockGeneratePngBuffers).toHaveBeenCalled();
    expect(result.pdfKey).toBeDefined();
    expect(result.pptxKey).toBeDefined();
    expect(result.slideImageKeys).toHaveLength(3);
  });

  it("正しい Content-Type で S3 にアップロードする", async () => {
    const event = { ...baseEvent, outputs: ["pdf"] as MarpRenderEvent["outputs"] };
    await handler(event);

    expect(s3MockSend).toHaveBeenCalled();
    const uploadCall = s3MockSend.mock.calls[0][0];
    expect(uploadCall.input.Bucket).toBe("test-bucket");
    expect(uploadCall.input.ContentType).toBe("application/pdf");
  });
});
