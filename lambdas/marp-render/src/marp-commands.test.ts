import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildPdfArgs, buildPptxArgs, buildPngArgs } from "./marp-commands.js";

// Mock child_process
vi.mock("node:child_process", () => ({
  execFile: vi.fn((_cmd, _args, _opts, callback) => {
    if (callback) {
      callback(null, "success", "");
    }
    return {};
  }),
}));

describe("Marp command builders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildPdfArgs", () => {
    it("constructs correct arguments for PDF generation", () => {
      const args = buildPdfArgs("deck.md");
      expect(args).toEqual(["--pdf", "deck.md"]);
    });
  });

  describe("buildPptxArgs", () => {
    it("constructs correct arguments for PPTX generation", () => {
      const args = buildPptxArgs("deck.md");
      expect(args).toEqual(["--pptx", "deck.md"]);
    });
  });

  describe("buildPngArgs", () => {
    it("constructs correct arguments for PNG generation with scale 2", () => {
      const args = buildPngArgs("deck.md");
      expect(args).toEqual(["--images", "png", "--image-scale", "2", "deck.md"]);
    });
  });
});
