import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@marp-team/marp-core", () => ({
  Marp: vi.fn(() => ({
    render: vi.fn(() => ({
      html: "<section id=\"1\"><h1>Slide 1</h1></section>",
      css: "body { margin: 0; }",
    })),
  })),
}));

vi.mock("@sparticuz/chromium", () => ({
  default: {
    executablePath: vi.fn().mockResolvedValue("/usr/bin/chromium"),
    args: ["--no-sandbox"],
    defaultViewport: { width: 1280, height: 720 },
  },
}));

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

describe("marp-commands (Docker-free)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renders Marp Markdown to HTML", () => {
    const html = renderMarpToHtml("# Hello");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<style>");
  });

  it("generates PDF buffer", async () => {
    const buffer = await generatePdfBuffer("# Test");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(mockClose).toHaveBeenCalled();
  });

  it("generates PNG buffers for each slide", async () => {
    const buffers = await generatePngBuffers("# Slide 1\n---\n# Slide 2");
    expect(buffers).toHaveLength(2);
    expect(mockClose).toHaveBeenCalled();
  });
});
