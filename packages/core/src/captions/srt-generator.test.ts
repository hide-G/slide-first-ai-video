import { describe, it, expect } from "vitest";
import { generateSrt, formatSrtTimestamp } from "./srt-generator.js";
import type { CaptionSegment } from "./caption-builder.js";

describe("formatSrtTimestamp", () => {
  it("formats zero ms", () => {
    expect(formatSrtTimestamp(0)).toBe("00:00:00,000");
  });

  it("formats milliseconds only", () => {
    expect(formatSrtTimestamp(500)).toBe("00:00:00,500");
  });

  it("formats seconds and milliseconds", () => {
    expect(formatSrtTimestamp(1500)).toBe("00:00:01,500");
  });

  it("formats minutes", () => {
    expect(formatSrtTimestamp(65000)).toBe("00:01:05,000");
  });

  it("formats hours", () => {
    expect(formatSrtTimestamp(3661500)).toBe("01:01:01,500");
  });

  it("uses comma separator (not dot)", () => {
    const result = formatSrtTimestamp(1234);
    expect(result).toContain(",");
    // Should have exactly one comma, for the ms separator
    expect(result.split(",")).toHaveLength(2);
  });
});

describe("generateSrt", () => {
  it("generates valid SRT format with sequential numbering", () => {
    const segments: CaptionSegment[] = [
      { text: "Hello world", startMs: 0, endMs: 2000, highlight: [] },
      { text: "Good morning", startMs: 2000, endMs: 4000, highlight: [] },
    ];

    const srt = generateSrt(segments);

    expect(srt).toContain("1\n00:00:00,000 --> 00:00:02,000\nHello world");
    expect(srt).toContain("2\n00:00:02,000 --> 00:00:04,000\nGood morning");
  });

  it("separates cues with blank lines", () => {
    const segments: CaptionSegment[] = [
      { text: "First", startMs: 0, endMs: 1000, highlight: [] },
      { text: "Second", startMs: 1000, endMs: 2000, highlight: [] },
    ];

    const srt = generateSrt(segments);
    // SRT blocks separated by double newline
    expect(srt).toContain("First\n\n2\n");
  });

  it("generates empty-ish SRT for no segments", () => {
    const srt = generateSrt([]);
    expect(srt).toBe("\n");
  });

  it("handles multi-line captions", () => {
    const segments: CaptionSegment[] = [
      { text: "Line one\nLine two", startMs: 0, endMs: 3000, highlight: [] },
    ];

    const srt = generateSrt(segments);
    expect(srt).toContain("Line one\nLine two");
  });

  it("ends with a newline", () => {
    const segments: CaptionSegment[] = [
      { text: "Hello", startMs: 0, endMs: 1000, highlight: [] },
    ];
    const srt = generateSrt(segments);
    expect(srt.endsWith("\n")).toBe(true);
  });
});
