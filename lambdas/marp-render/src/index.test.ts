import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./marp-commands.js", () => ({
  generatePdfBuffer: vi.fn().mockResolvedValue(Buffer.from("mock-pdf")),
  generatePptxBuffer: vi.fn().mockResolvedValue(Buffer.from("mock-pptx")),
  generatePngBuffers: vi.fn().mockResolvedValue([
    Buffer.from("png-1"),
    Buffer.from("png-2"),
    Buffer.from("png-3"),
  ]),
}));

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
  let mockGeneratePdfBuffer: ReturnType<typeof vi.fn>;
  let mockGeneratePngBuffers: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const marpModule = await import("./marp-commands.js");
    mockGeneratePdfBuffer = marpModule.generatePdfBuffer as ReturnType<typeof vi.fn>;
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

  it("generates PDF when requested", async () => {
    const event = { ...baseEvent, outputs: ["pdf"] as MarpRenderEvent["outputs"] };
    const result = await handler(event) as { pdfKey?: string };
    expect(mockGeneratePdfBuffer).toHaveBeenCalledWith(baseEvent.deckMarkdown);
    expect(result.pdfKey).toBe("user-456/proj-123/versions/v0001/deck.pdf");
  });

  it("generates PNG images when requested", async () => {
    const event = { ...baseEvent, outputs: ["png"] as MarpRenderEvent["outputs"] };
    const result = await handler(event) as { slideImageKeys: string[] };
    expect(mockGeneratePngBuffers).toHaveBeenCalledWith(baseEvent.deckMarkdown);
    expect(result.slideImageKeys).toHaveLength(3);
  });
});
