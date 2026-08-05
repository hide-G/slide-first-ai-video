import { describe, it, expect } from "vitest";
import { buildCaptions } from "./caption-builder.js";
import type { SpeechMark } from "./speech-marks-parser.js";

function makeWordMark(time: number, value: string): SpeechMark {
  return { time, type: "word", start: 0, end: value.length, value };
}

describe("buildCaptions", () => {
  it("returns empty array for empty input", () => {
    const result = buildCaptions([], 0);
    expect(result).toEqual([]);
  });

  it("creates a single segment for short text", () => {
    const marks: SpeechMark[] = [
      makeWordMark(0, "Hello"),
      makeWordMark(200, "world"),
    ];
    const result = buildCaptions(marks, 2000);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Hello world");
    expect(result[0].startMs).toBe(0);
    expect(result[0].endMs).toBe(2000);
  });

  it("respects max 20 chars per line", () => {
    // "This is a" = 9 chars, "demonstration" = 13 chars
    // "This is a demonstration" = 23 chars > 20, so should split
    const marks: SpeechMark[] = [
      makeWordMark(0, "This"),
      makeWordMark(200, "is"),
      makeWordMark(400, "a"),
      makeWordMark(600, "demonstration"),
    ];
    const result = buildCaptions(marks, 5000);

    expect(result.length).toBeGreaterThanOrEqual(1);
    // Check that no single line exceeds 20 chars
    for (const seg of result) {
      const lines = seg.text.split("\n");
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(20);
      }
    }
  });

  it("respects max 2 lines per segment", () => {
    const marks: SpeechMark[] = [
      makeWordMark(0, "First"),
      makeWordMark(200, "line"),
      makeWordMark(400, "here"),
      makeWordMark(600, "Second"),
      makeWordMark(800, "line"),
      makeWordMark(1000, "here"),
      makeWordMark(1200, "Third"),
      makeWordMark(1400, "line"),
      makeWordMark(1600, "here"),
    ];
    const result = buildCaptions(marks, 5000);

    for (const seg of result) {
      const lines = seg.text.split("\n");
      expect(lines.length).toBeLessThanOrEqual(2);
    }
  });

  it("enforces minimum 1200ms display time by merging short segments", () => {
    // Very rapid words should be merged into longer segments
    const marks: SpeechMark[] = [
      makeWordMark(0, "A"),
      makeWordMark(100, "B"),
      makeWordMark(200, "C"),
      makeWordMark(300, "D"),
      makeWordMark(400, "E"),
      makeWordMark(500, "F"),
    ];
    const result = buildCaptions(marks, 2000);

    for (const seg of result) {
      const duration = seg.endMs - seg.startMs;
      expect(duration).toBeGreaterThanOrEqual(1200);
    }
  });

  it("marks keyPoints words for highlight", () => {
    const marks: SpeechMark[] = [
      makeWordMark(0, "The"),
      makeWordMark(200, "TypeScript"),
      makeWordMark(600, "compiler"),
      makeWordMark(1000, "is"),
      makeWordMark(1200, "fast"),
    ];
    const result = buildCaptions(marks, 5000, {
      keyPoints: ["TypeScript", "fast"],
    });

    // At least one segment should highlight TypeScript and/or fast
    const allHighlights = result.flatMap((s) => s.highlight);
    expect(allHighlights).toContain("TypeScript");
    expect(allHighlights).toContain("fast");
  });

  it("handles keyPoints matching case-insensitively", () => {
    const marks: SpeechMark[] = [
      makeWordMark(0, "Hello"),
      makeWordMark(500, "WORLD"),
    ];
    const result = buildCaptions(marks, 5000, { keyPoints: ["world"] });

    const allHighlights = result.flatMap((s) => s.highlight);
    expect(allHighlights).toContain("WORLD");
  });

  it("handles single word input", () => {
    const marks: SpeechMark[] = [makeWordMark(0, "Hello")];
    const result = buildCaptions(marks, 1500);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Hello");
    expect(result[0].startMs).toBe(0);
    expect(result[0].endMs).toBe(1500);
  });

  it("uses custom options when provided", () => {
    const marks: SpeechMark[] = [
      makeWordMark(0, "Short"),
      makeWordMark(200, "text"),
    ];
    const result = buildCaptions(marks, 3000, {
      maxCharsPerLine: 10,
      maxLines: 1,
      minDurationMs: 500,
    });

    for (const seg of result) {
      const lines = seg.text.split("\n");
      expect(lines.length).toBeLessThanOrEqual(1);
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(10);
      }
    }
  });
});
