import { describe, it, expect } from "vitest";
import {
  inputSourceKey,
  deckKey,
  pageImageKey,
  audioKey,
  captionsSrtKey,
  clipKey,
  outputVideoKey,
  manifestKey,
  projectPrefix,
} from "./s3-keys.js";

const params = { userId: "u_0001", projectId: "p_0001" };

describe("S3 key builders", () => {
  describe("inputSourceKey", () => {
    it("generates correct PDF input key", () => {
      expect(inputSourceKey(params, "pdf")).toBe(
        "users/u_0001/projects/p_0001/input/source.pdf"
      );
    });

    it("generates correct PPTX input key", () => {
      expect(inputSourceKey(params, "pptx")).toBe(
        "users/u_0001/projects/p_0001/input/source.pptx"
      );
    });
  });

  describe("deckKey", () => {
    it("generates correct MD deck key", () => {
      expect(deckKey(params, "md")).toBe(
        "users/u_0001/projects/p_0001/deck/deck.md"
      );
    });

    it("generates correct PDF deck key", () => {
      expect(deckKey(params, "pdf")).toBe(
        "users/u_0001/projects/p_0001/deck/deck.pdf"
      );
    });

    it("generates correct PPTX deck key", () => {
      expect(deckKey(params, "pptx")).toBe(
        "users/u_0001/projects/p_0001/deck/deck.pptx"
      );
    });
  });

  describe("pageImageKey", () => {
    it("generates correct key with zero-padded page number", () => {
      expect(pageImageKey(params, 1)).toBe(
        "users/u_0001/projects/p_0001/pages/page-001.png"
      );
    });

    it("handles double-digit pages", () => {
      expect(pageImageKey(params, 12)).toBe(
        "users/u_0001/projects/p_0001/pages/page-012.png"
      );
    });

    it("handles triple-digit pages", () => {
      expect(pageImageKey(params, 100)).toBe(
        "users/u_0001/projects/p_0001/pages/page-100.png"
      );
    });
  });

  describe("audioKey", () => {
    it("generates correct audio key", () => {
      expect(audioKey(params, 1)).toBe(
        "users/u_0001/projects/p_0001/audio/page-001.mp3"
      );
    });

    it("handles page 5", () => {
      expect(audioKey(params, 5)).toBe(
        "users/u_0001/projects/p_0001/audio/page-005.mp3"
      );
    });
  });

  describe("captionsSrtKey", () => {
    it("generates correct captions key", () => {
      expect(captionsSrtKey(params)).toBe(
        "users/u_0001/projects/p_0001/captions/captions.srt"
      );
    });
  });

  describe("clipKey", () => {
    it("generates correct clip key", () => {
      expect(clipKey(params, 3)).toBe(
        "users/u_0001/projects/p_0001/clips/page-003.mp4"
      );
    });
  });

  describe("outputVideoKey", () => {
    it("generates correct output video key", () => {
      expect(outputVideoKey(params, "r_abc123")).toBe(
        "users/u_0001/projects/p_0001/output/r_abc123/video.mp4"
      );
    });
  });

  describe("manifestKey", () => {
    it("generates correct manifest key", () => {
      expect(manifestKey(params)).toBe(
        "users/u_0001/projects/p_0001/manifest.json"
      );
    });
  });

  describe("projectPrefix", () => {
    it("generates correct prefix with trailing slash", () => {
      expect(projectPrefix(params)).toBe(
        "users/u_0001/projects/p_0001/"
      );
    });
  });
});
