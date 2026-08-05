import { describe, it, expect } from "vitest";
import { generateVtt, formatVttTimestamp } from "./vtt-generator.js";
import type { CaptionSegment } from "./caption-builder.js";

describe("formatVttTimestamp", () => {
  it("formats zero ms", () => {
    expect(formatVttTimestamp(0)).toBe("00:00:00.000");
  });

  it("formats milliseconds only", () => {
    expect(formatVttTimestamp(500)).toBe("00:00:00.500");
  });

  it("formats seconds and milliseconds", () => {
    expect(formatVttTimestamp(1500)).toBe("00:00:01.500");
  });

  it("formats minutes", () => {
    expect(formatVttTimestamp(65000)).toBe("00:01:05.000");
  });

  it("formats hours", () => {
    expect(formatVttTimestamp(3661500)).toBe("01:01:01.500");
  });

  it("uses dot separator (not comma)", () => {
    const result = formatVttTimestamp(1234);
    expect(result).toContain(".");
    expect(result).not.toContain(",");
  });
});

describe("generateVtt", () => {
  it("generates valid WebVTT with header", () => {
    const segments: CaptionSegment[] = [
      { text: "Hello world", startMs: 0, endMs: 2000, highlight: [] },
      { text: "Good morning", startMs: 2000, endMs: 4000, highlight: [] },
    ];

    const vtt = generateVtt(segments);

    expect(vtt.startsWith("WEBVTT\n\n")).toBe(true);
    expect(vtt).toContain("1\n00:00:00.000 --> 00:00:02.000\nHello world");
    expect(vtt).toContain("2\n00:00:02.000 --> 00:00:04.000\nGood morning");
  });

  it("generates empty VTT for no segments", () => {
    const vtt = generateVtt([]);
    expect(vtt).toBe("WEBVTT\n\n");
  });

  it("handles multi-line captions", () => {
    const segments: CaptionSegment[] = [
      { text: "Line one\nLine two", startMs: 0, endMs: 3000, highlight: [] },
    ];

    const vtt = generateVtt(segments);
    expect(vtt).toContain("Line one\nLine two");
  });

  it("uses sequential numbering starting at 1", () => {
    const segments: CaptionSegment[] = [
      { text: "First", startMs: 0, endMs: 1000, highlight: [] },
      { text: "Second", startMs: 1000, endMs: 2000, highlight: [] },
      { text: "Third", startMs: 2000, endMs: 3000, highlight: [] },
    ];

    const vtt = generateVtt(segments);
    expect(vtt).toContain("\n1\n");
    expect(vtt).toContain("\n2\n");
    expect(vtt).toContain("\n3\n");
  });
});
