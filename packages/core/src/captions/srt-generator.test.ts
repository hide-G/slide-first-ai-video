import { describe, it, expect } from "vitest";
import { generateSrt, formatSrtTimestamp } from "./srt-generator.js";

describe("SRT generator", () => {
  describe("formatSrtTimestamp", () => {
    it("formats 0 seconds", () => {
      expect(formatSrtTimestamp(0)).toBe("00:00:00,000");
    });

    it("formats fractional seconds", () => {
      expect(formatSrtTimestamp(5.5)).toBe("00:00:05,500");
    });

    it("formats minutes", () => {
      expect(formatSrtTimestamp(65.123)).toBe("00:01:05,123");
    });

    it("formats hours", () => {
      expect(formatSrtTimestamp(3661.5)).toBe("01:01:01,500");
    });

    it("handles sub-millisecond precision by rounding", () => {
      expect(formatSrtTimestamp(1.9999)).toBe("00:00:02,000");
    });
  });

  describe("generateSrt", () => {
    it("generates SRT from pages with cumulative frameAlignedDurationMs timing", () => {
      const pages = [
        {
          pageNumber: 1,
          frameAlignedDurationMs: 5000,
          script: { mode: "plain" as const, text: "First page narration" },
        },
        {
          pageNumber: 2,
          frameAlignedDurationMs: 3534,
          script: { mode: "plain" as const, text: "Second page narration" },
        },
        {
          pageNumber: 3,
          frameAlignedDurationMs: 4200,
          script: { mode: "plain" as const, text: "Third page narration" },
        },
      ];

      const srt = generateSrt(pages);

      expect(srt).toBe(
        "1\n00:00:00,000 --> 00:00:05,000\nFirst page narration\n\n" +
          "2\n00:00:05,000 --> 00:00:08,534\nSecond page narration\n\n" +
          "3\n00:00:08,534 --> 00:00:12,734\nThird page narration\n",
      );
    });

    it("returns empty string for empty pages", () => {
      expect(generateSrt([])).toBe("");
    });

    it("skips pages with empty script text", () => {
      const pages = [
        {
          pageNumber: 1,
          frameAlignedDurationMs: 3000,
          script: { mode: "plain" as const, text: "Hello" },
        },
        {
          pageNumber: 2,
          frameAlignedDurationMs: 2000,
          script: { mode: "plain" as const, text: "" },
        },
        {
          pageNumber: 3,
          frameAlignedDurationMs: 4000,
          script: { mode: "plain" as const, text: "World" },
        },
      ];

      const srt = generateSrt(pages);

      // Entry numbers should be sequential (1, 2) skipping the empty page
      expect(srt).toBe(
        "1\n00:00:00,000 --> 00:00:03,000\nHello\n\n" +
          "2\n00:00:05,000 --> 00:00:09,000\nWorld\n",
      );
    });

    it("handles single page", () => {
      const pages = [
        {
          pageNumber: 1,
          frameAlignedDurationMs: 10000,
          script: { mode: "plain" as const, text: "Solo page" },
        },
      ];

      const srt = generateSrt(pages);

      expect(srt).toBe("1\n00:00:00,000 --> 00:00:10,000\nSolo page\n");
    });

    it("trims script text whitespace", () => {
      const pages = [
        {
          pageNumber: 1,
          frameAlignedDurationMs: 2000,
          script: { mode: "plain" as const, text: "  trimmed  " },
        },
      ];

      const srt = generateSrt(pages);
      expect(srt).toContain("trimmed");
      expect(srt).not.toContain("  trimmed  ");
    });
  });
});
