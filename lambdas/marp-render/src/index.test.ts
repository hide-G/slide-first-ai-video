import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @sparticuz/chromium
vi.mock("@sparticuz/chromium", () => ({
  default: {
    executablePath: vi.fn().mockResolvedValue("/tmp/chromium"),
    args: ["--no-sandbox"],
    headless: "shell",
  },
}));

// Mock puppeteer-core
const mockScreenshot = vi.fn().mockResolvedValue(Buffer.from("fake-png"));
const mockPage = {
  setContent: vi.fn().mockResolvedValue(undefined),
  evaluate: vi.fn(),
  pdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-fake")),
  $$: vi.fn().mockResolvedValue([
    { screenshot: mockScreenshot },
    { screenshot: mockScreenshot },
  ]),
  newPage: undefined as unknown,
};

const mockBrowser = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock("puppeteer-core", () => ({
  default: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

// Mock pptxgenjs
vi.mock("pptxgenjs", () => {
  const mockSlide = {
    addImage: vi.fn(),
  };
  return {
    default: vi.fn().mockImplementation(() => ({
      defineLayout: vi.fn(),
      layout: "",
      addSlide: vi.fn().mockReturnValue(mockSlide),
      write: vi.fn().mockResolvedValue(Buffer.from("fake-pptx")),
    })),
  };
});

// Mock @marp-team/marp-core
vi.mock("@marp-team/marp-core", () => ({
  Marp: vi.fn().mockImplementation(() => ({
    render: vi.fn().mockReturnValue({
      html: '<section>Slide 1</section><section>Slide 2</section>',
      css: "section { width: 1920px; height: 1080px; }",
    }),
  })),
}));

// Mock fs/promises (for font and pdf.js file reads)
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockImplementation((filePath: string) => {
    if (typeof filePath === "string" && filePath.includes("noto-sans-jp")) {
      return Promise.resolve(Buffer.from("fake-font-data"));
    }
    if (typeof filePath === "string" && filePath.includes("pdf.min.mjs")) {
      return Promise.resolve("// pdf.js lib source");
    }
    if (typeof filePath === "string" && filePath.includes("pdf.worker.min.mjs")) {
      return Promise.resolve("// pdf.js worker source");
    }
    return Promise.resolve(Buffer.from("unknown-file"));
  }),
}));

// Mock AWS SDK
const mockSend = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({ send: mockSend })),
  GetObjectCommand: vi.fn((input: unknown) => ({ type: "get", input })),
  PutObjectCommand: vi.fn((input: unknown) => ({ type: "put", input })),
}));

describe("marp-render handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: font verification passes
    mockPage.evaluate.mockImplementation((fn: Function | string) => {
      // document.fonts.ready
      if (typeof fn === "function" && fn.toString().includes("fonts.ready")) {
        return Promise.resolve(undefined);
      }
      // Font verification (measureText)
      if (typeof fn === "function" && fn.toString().includes("measureText")) {
        return Promise.resolve(true);
      }
      // pdf.js evaluate (for pages stage)
      if (typeof fn === "function" && fn.toString().includes("getDocument")) {
        return Promise.resolve([
          "data:image/png;base64,AAAA",
          "data:image/png;base64,BBBB",
          "data:image/png;base64,CCCC",
        ]);
      }
      return Promise.resolve(undefined);
    });

    // S3 mock
    mockSend.mockImplementation((cmd: { type: string; input?: { Key?: string } }) => {
      if (cmd.type === "get") {
        if (cmd.input?.Key?.endsWith("manifest.json")) {
          return Promise.resolve({
            Body: {
              transformToString: () => Promise.resolve(JSON.stringify({
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
                output: { aspect: "16:9", width: 1920, height: 1080, fps: 30, captions: "burn", verticalLayout: null, padColor: null },
                lexicon: [],
                pages: [
                  { pageNumber: 1, imageKey: "pages/page-001.png", script: { mode: "plain", text: "Hello" }, audioKey: "audio/page-001.wav", audioDurationSec: 0, frameAlignedDurationMs: 0 },
                  { pageNumber: 2, imageKey: "pages/page-002.png", script: { mode: "plain", text: "World" }, audioKey: "audio/page-002.wav", audioDurationSec: 0, frameAlignedDurationMs: 0 },
                  { pageNumber: 3, imageKey: "pages/page-003.png", script: { mode: "plain", text: "End" }, audioKey: "audio/page-003.wav", audioDurationSec: 0, frameAlignedDurationMs: 0 },
                ],
                stages: { pages: "pending", audio: "pending", captions: "pending", video: "pending" },
              })),
            },
          });
        }
        // PDF download
        return Promise.resolve({
          Body: { transformToByteArray: () => Promise.resolve(new Uint8Array([0x25, 0x50, 0x44, 0x46])) },
        });
      }
      return Promise.resolve({});
    });
  });

  describe("action: generateDeck", () => {
    it("dispatches to generateDeck handler and returns success", async () => {
      const { handler } = await import("./index.js");
      const result = await handler({
        action: "generateDeck",
        s3Bucket: "test-bucket",
        s3Prefix: "users/user-1/projects/proj-1/",
        projectId: "proj-1",
        userId: "user-1",
        markdown: "---\nmarp: true\n---\n# Slide 1\n---\n# Slide 2",
      });

      expect(result.success).toBe(true);
      expect(result.pageCount).toBe(2); // 2 sections from mock
    });

    it("uploads deck.md, deck.pdf, deck.pptx, and page PNGs to S3", async () => {
      const { handler } = await import("./index.js");
      await handler({
        action: "generateDeck",
        s3Bucket: "test-bucket",
        s3Prefix: "users/user-1/projects/proj-1/",
        projectId: "proj-1",
        userId: "user-1",
        markdown: "---\nmarp: true\n---\n# Slide 1\n---\n# Slide 2",
      });

      const putCalls = mockSend.mock.calls.filter(
        (call: unknown[]) => (call[0] as { type: string }).type === "put",
      );
      // deck.md + deck.pdf + 2 page PNGs + deck.pptx = 5
      expect(putCalls.length).toBe(5);

      // Check keys
      const keys = putCalls.map(
        (call: unknown[]) => ((call[0] as { input: { Key: string } }).input.Key),
      );
      expect(keys).toContain("users/user-1/projects/proj-1/deck/deck.md");
      expect(keys).toContain("users/user-1/projects/proj-1/deck/deck.pdf");
      expect(keys).toContain("users/user-1/projects/proj-1/deck/deck.pptx");
      expect(keys).toContain("users/user-1/projects/proj-1/pages/page-001.png");
      expect(keys).toContain("users/user-1/projects/proj-1/pages/page-002.png");
    });

    it("returns error when font verification fails", async () => {
      mockPage.evaluate.mockImplementation((fn: Function | string) => {
        if (typeof fn === "function" && fn.toString().includes("fonts.ready")) {
          return Promise.resolve(undefined);
        }
        if (typeof fn === "function" && fn.toString().includes("measureText")) {
          return Promise.resolve(false); // Font not applied
        }
        return Promise.resolve(undefined);
      });

      const { handler } = await import("./index.js");
      const result = await handler({
        action: "generateDeck",
        s3Bucket: "test-bucket",
        s3Prefix: "users/user-1/projects/proj-1/",
        projectId: "proj-1",
        userId: "user-1",
        markdown: "# Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("font verification failed");
    });

    it("closes browser even on error", async () => {
      mockPage.evaluate.mockImplementation((fn: Function | string) => {
        if (typeof fn === "function" && fn.toString().includes("fonts.ready")) {
          return Promise.resolve(undefined);
        }
        if (typeof fn === "function" && fn.toString().includes("measureText")) {
          return Promise.resolve(false);
        }
        return Promise.resolve(undefined);
      });

      const { handler } = await import("./index.js");
      await handler({
        action: "generateDeck",
        s3Bucket: "test-bucket",
        s3Prefix: "users/user-1/projects/proj-1/",
        projectId: "proj-1",
        userId: "user-1",
        markdown: "# Test",
      });

      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe("stage: pages (pdf.js rasterization)", () => {
    it("dispatches to pages handler and returns success", async () => {
      const { handler } = await import("./index.js");
      const result = await handler({
        stage: "pages",
        s3Bucket: "test-bucket",
        s3Prefix: "users/user-1/projects/proj-1/",
        projectId: "proj-1",
        userId: "user-1",
        renderId: "render-1",
      });

      expect(result.success).toBe(true);
      expect(result.pageCount).toBe(3); // 3 pages from mock evaluate
      expect((result as { pages: unknown[] }).pages).toEqual([
        { pageNumber: 1 },
        { pageNumber: 2 },
        { pageNumber: 3 },
      ]);
    });

    it("uploads page PNGs to S3 and updates manifest", async () => {
      const { handler } = await import("./index.js");
      await handler({
        stage: "pages",
        s3Bucket: "test-bucket",
        s3Prefix: "users/user-1/projects/proj-1/",
        projectId: "proj-1",
        userId: "user-1",
        renderId: "render-1",
      });

      const putCalls = mockSend.mock.calls.filter(
        (call: unknown[]) => (call[0] as { type: string }).type === "put",
      );
      // manifest "running" + 3 PNGs + manifest "done" = 5
      expect(putCalls.length).toBe(5);
    });

    it("sets stage to failed on error and closes browser", async () => {
      mockPage.evaluate.mockImplementation((fn: Function | string) => {
        if (typeof fn === "function" && fn.toString().includes("getDocument")) {
          return Promise.reject(new Error("pdf.js parse error"));
        }
        return Promise.resolve(undefined);
      });

      const { handler } = await import("./index.js");
      const result = await handler({
        stage: "pages",
        s3Bucket: "test-bucket",
        s3Prefix: "users/user-1/projects/proj-1/",
        projectId: "proj-1",
        userId: "user-1",
        renderId: "render-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("pdf.js parse error");
      expect(mockBrowser.close).toHaveBeenCalled();

      // Check manifest was set to failed
      const putCalls = mockSend.mock.calls.filter(
        (call: unknown[]) => (call[0] as { type: string }).type === "put",
      );
      const lastPutInput = putCalls[putCalls.length - 1][0] as { input: { Body: string } };
      const finalManifest = JSON.parse(lastPutInput.input.Body);
      expect(finalManifest.stages.pages).toBe("failed");
    });
  });

  describe("event dispatch", () => {
    it("throws on unknown event shape", async () => {
      const { handler } = await import("./index.js");
      await expect(
        handler({ unknown: true } as unknown as import("./index.js").MarpRenderEvent),
      ).rejects.toThrow("Unknown event shape");
    });
  });

  describe("asset path resolution", () => {
    it("resolves font path relative to __dirname/assets", async () => {
      const { readFile } = await import("node:fs/promises");
      const { handler } = await import("./index.js");

      await handler({
        action: "generateDeck",
        s3Bucket: "test-bucket",
        s3Prefix: "users/user-1/projects/proj-1/",
        projectId: "proj-1",
        userId: "user-1",
        markdown: "# Test",
      });

      // readFile should have been called with a path containing 'assets/noto-sans-jp.woff2'
      const calls = vi.mocked(readFile).mock.calls;
      const fontCall = calls.find((c) => String(c[0]).includes("noto-sans-jp.woff2"));
      expect(fontCall).toBeDefined();
    });

    it("resolves pdf.js paths relative to __dirname/assets", async () => {
      const { readFile } = await import("node:fs/promises");
      const { handler } = await import("./index.js");

      await handler({
        stage: "pages",
        s3Bucket: "test-bucket",
        s3Prefix: "users/user-1/projects/proj-1/",
        projectId: "proj-1",
        userId: "user-1",
        renderId: "render-1",
      });

      const calls = vi.mocked(readFile).mock.calls;
      const pdfCall = calls.find((c) => String(c[0]).includes("pdf.min.mjs"));
      const workerCall = calls.find((c) => String(c[0]).includes("pdf.worker.min.mjs"));
      expect(pdfCall).toBeDefined();
      expect(workerCall).toBeDefined();
    });
  });
});
