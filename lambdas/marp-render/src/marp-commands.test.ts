import { describe, it, expect, vi, beforeEach } from "vitest";

// @marp-team/marp-core をモック
vi.mock("@marp-team/marp-core", () => ({
  Marp: vi.fn(() => ({
    render: vi.fn(() => ({
      html: "<section id=\"1\"><h1>Slide 1</h1></section>",
      css: "body { margin: 0; }",
    })),
  })),
}));

// @sparticuz/chromium をモック
vi.mock("@sparticuz/chromium", () => ({
  default: {
    executablePath: vi.fn().mockResolvedValue("/usr/bin/chromium"),
    args: ["--no-sandbox"],
    defaultViewport: { width: 1280, height: 720 },
  },
}));

// puppeteer-core をモック
const mockScreenshot = vi.fn().mockResolvedValue(Buffer.from("png-data"));
const mockPdf = vi.fn().mockResolvedValue(Buffer.from("pdf-data"));
const mockSetContent = vi.fn().mockResolvedValue(undefined);
const mockSetViewport = vi.fn().mockResolvedValue(undefined);
const mock$$ = vi.fn().mockResolvedValue([
  { screenshot: mockScreenshot },
  { screenshot: mockScreenshot },
]);
const mockNewPage = vi.fn().mockResolvedValue({
  setContent: mockSetContent,
  setViewport: mockSetViewport,
  pdf: mockPdf,
  $$: mock$$,
  screenshot: mockScreenshot,
});
const mockClose = vi.fn().mockResolvedValue(undefined);

vi.mock("puppeteer-core", () => ({
  default: {
    launch: vi.fn().mockResolvedValue({
      newPage: mockNewPage,
      close: mockClose,
    }),
  },
}));

import { renderMarpToHtml, generatePdfBuffer, generatePngBuffers } from "./marp-commands.js";

describe("marp-commands (Docker不要版)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("renderMarpToHtml", () => {
    it("Marp Markdown を HTML に変換する", () => {
      const html = renderMarpToHtml("# Hello");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<style>");
      expect(html).toContain("</html>");
    });
  });

  describe("generatePdfBuffer", () => {
    it("PDF バッファを返す", async () => {
      const buffer = await generatePdfBuffer("# Test");
      expect(buffer).toBeInstanceOf(Buffer);
      expect(mockPdf).toHaveBeenCalledWith(
        expect.objectContaining({ printBackground: true }),
      );
      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe("generatePngBuffers", () => {
    it("各スライドの PNG バッファ配列を返す", async () => {
      const buffers = await generatePngBuffers("# Slide 1\n---\n# Slide 2");
      expect(buffers).toHaveLength(2);
      expect(buffers[0]).toBeInstanceOf(Buffer);
      expect(mockClose).toHaveBeenCalled();
    });
  });
});
