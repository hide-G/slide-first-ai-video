import { describe, it, expect } from "vitest";
import {
  inputSourceKey,
  deckKey,
  pageImageKey,
  audioKey,
  captionsSrtKey,
  outputVideoKey,
  manifestKey,
  projectPrefix,
  pageKeys,
  renderKeys,
} from "./s3-keys.js";

describe("S3 key builders", () => {
  const params = { userId: "user-123", projectId: "proj-456" };

  describe("inputSourceKey", () => {
    it("builds PDF input key", () => {
      expect(inputSourceKey(params, "pdf")).toBe(
        "users/user-123/projects/proj-456/input/source.pdf",
      );
    });

    it("builds PPTX input key", () => {
      expect(inputSourceKey(params, "pptx")).toBe(
        "users/user-123/projects/proj-456/input/source.pptx",
      );
    });
  });

  describe("deckKey", () => {
    it("builds deck key for md", () => {
      expect(deckKey(params, "md")).toBe(
        "users/user-123/projects/proj-456/deck/deck.md",
      );
    });

    it("builds deck key for pdf", () => {
      expect(deckKey(params, "pdf")).toBe(
        "users/user-123/projects/proj-456/deck/deck.pdf",
      );
    });
  });

  describe("pageImageKey", () => {
    it("builds page image key with zero-padded number", () => {
      expect(pageImageKey(params, 1)).toBe(
        "users/user-123/projects/proj-456/pages/page-001.png",
      );
    });

    it("handles larger page numbers", () => {
      expect(pageImageKey(params, 12)).toBe(
        "users/user-123/projects/proj-456/pages/page-012.png",
      );
    });
  });

  describe("audioKey", () => {
    it("builds audio key as WAV", () => {
      expect(audioKey(params, 3)).toBe(
        "users/user-123/projects/proj-456/audio/page-003.wav",
      );
    });
  });

  describe("captionsSrtKey", () => {
    it("builds captions SRT key", () => {
      expect(captionsSrtKey(params)).toBe(
        "users/user-123/projects/proj-456/captions/captions.srt",
      );
    });
  });

  describe("outputVideoKey", () => {
    it("builds output video key with renderId", () => {
      expect(outputVideoKey(params, "render-abc")).toBe(
        "users/user-123/projects/proj-456/output/render-abc/video.mp4",
      );
    });
  });

  describe("manifestKey", () => {
    it("builds manifest key at project root", () => {
      expect(manifestKey(params)).toBe(
        "users/user-123/projects/proj-456/manifest.json",
      );
    });
  });

  describe("projectPrefix", () => {
    it("builds project prefix with trailing slash", () => {
      expect(projectPrefix(params)).toBe(
        "users/user-123/projects/proj-456/",
      );
    });
  });

  describe("pageKeys", () => {
    it("returns image and audio keys for a page", () => {
      const keys = pageKeys(params, 2);
      expect(keys).toEqual({
        image: "users/user-123/projects/proj-456/pages/page-002.png",
        audio: "users/user-123/projects/proj-456/audio/page-002.wav",
      });
    });
  });

  describe("renderKeys", () => {
    it("returns all keys for a complete render", () => {
      const keys = renderKeys(params, "render-xyz", 3);
      expect(keys.manifest).toBe(
        "users/user-123/projects/proj-456/manifest.json",
      );
      expect(keys.captionsSrt).toBe(
        "users/user-123/projects/proj-456/captions/captions.srt",
      );
      expect(keys.outputVideo).toBe(
        "users/user-123/projects/proj-456/output/render-xyz/video.mp4",
      );
      expect(keys.pages).toHaveLength(3);
      expect(keys.pages[0].image).toBe(
        "users/user-123/projects/proj-456/pages/page-001.png",
      );
      expect(keys.pages[2].audio).toBe(
        "users/user-123/projects/proj-456/audio/page-003.wav",
      );
    });
  });
});
