import { describe, it, expect } from "vitest";
import type { ManifestSlide } from "@slide-first/shared-types";
import {
  estimateReadingDurationMs,
  filterTeaserCandidates,
  selectTeaserSlides,
} from "./slide-selector.js";

function makeManifestSlide(overrides: Partial<ManifestSlide> = {}): ManifestSlide {
  return {
    slideNumber: 1,
    imageKey: "slides/slide-1.png",
    imageSha256: "abc123",
    presenterNote: "Full presenter note",
    teaserNote: "Short teaser note for this slide",
    keyPoints: ["point 1", "point 2"],
    voiceKey: "audio/slide-1.pcm",
    speechMarksKey: "audio/slide-1.marks.json",
    measuredAudioMs: 8000,
    leadInMs: 200,
    leadOutMs: 300,
    durationMs: 8500,
    startMs: 0,
    transition: "fade",
    importance: "HIGH",
    includeInXTeaser: true,
    ...overrides,
  };
}

describe("estimateReadingDurationMs", () => {
  it("estimates duration based on 150 words per minute", () => {
    // 15 words at 150 wpm = 6 seconds = 6000ms
    const text = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen";
    expect(estimateReadingDurationMs(text)).toBe(6000);
  });

  it("returns 0 for empty text", () => {
    expect(estimateReadingDurationMs("")).toBe(0);
    expect(estimateReadingDurationMs("  ")).toBe(0);
  });

  it("handles single word", () => {
    // 1 word at 150 wpm = 0.4s = 400ms
    expect(estimateReadingDurationMs("Hello")).toBe(400);
  });
});

describe("filterTeaserCandidates", () => {
  it("returns HIGH importance slides with includeInXTeaser=true", () => {
    const slides = [
      makeManifestSlide({ slideNumber: 1, importance: "HIGH", includeInXTeaser: true }),
      makeManifestSlide({ slideNumber: 2, importance: "HIGH", includeInXTeaser: true }),
      makeManifestSlide({ slideNumber: 3, importance: "HIGH", includeInXTeaser: true }),
      makeManifestSlide({ slideNumber: 4, importance: "HIGH", includeInXTeaser: false }),
      makeManifestSlide({ slideNumber: 5, importance: "MEDIUM", includeInXTeaser: true }),
      makeManifestSlide({ slideNumber: 6, importance: "LOW", includeInXTeaser: true }),
    ];

    const result = filterTeaserCandidates(slides);
    // Only the 3 HIGH + includeInXTeaser slides (>= minSlides=3), no fallback needed
    expect(result.length).toBe(3);
    expect(result.map((s) => s.slideNumber)).toEqual([1, 2, 3]);
  });

  it("falls back to MEDIUM importance when not enough HIGH", () => {
    const slides = [
      makeManifestSlide({ slideNumber: 1, importance: "HIGH", includeInXTeaser: true }),
      makeManifestSlide({ slideNumber: 2, importance: "HIGH", includeInXTeaser: true }),
      makeManifestSlide({ slideNumber: 3, importance: "MEDIUM", includeInXTeaser: true }),
      makeManifestSlide({ slideNumber: 4, importance: "MEDIUM", includeInXTeaser: true }),
      makeManifestSlide({ slideNumber: 5, importance: "LOW", includeInXTeaser: true }),
    ];

    const result = filterTeaserCandidates(slides);
    // Only 2 HIGH (< minSlides=3), so include MEDIUM too
    expect(result.length).toBe(4);
    expect(result.map((s) => s.slideNumber)).toEqual([1, 2, 3, 4]);
  });

  it("does not include MEDIUM if enough HIGH slides exist", () => {
    const slides = [
      makeManifestSlide({ slideNumber: 1, importance: "HIGH", includeInXTeaser: true }),
      makeManifestSlide({ slideNumber: 2, importance: "HIGH", includeInXTeaser: true }),
      makeManifestSlide({ slideNumber: 3, importance: "HIGH", includeInXTeaser: true }),
      makeManifestSlide({ slideNumber: 4, importance: "MEDIUM", includeInXTeaser: true }),
    ];

    const result = filterTeaserCandidates(slides);
    expect(result.length).toBe(3);
    expect(result.every((s) => s.importance === "HIGH")).toBe(true);
  });
});

describe("selectTeaserSlides", () => {
  it("uses Bedrock-selected slide numbers when provided", () => {
    const slides = [
      makeManifestSlide({ slideNumber: 1, importance: "HIGH", includeInXTeaser: true }),
      makeManifestSlide({ slideNumber: 2, importance: "MEDIUM", includeInXTeaser: false }),
      makeManifestSlide({ slideNumber: 3, importance: "HIGH", includeInXTeaser: true }),
      makeManifestSlide({ slideNumber: 4, importance: "LOW", includeInXTeaser: false }),
    ];

    const result = selectTeaserSlides(slides, [3, 1]);
    expect(result.length).toBe(2);
    expect(result[0].slideNumber).toBe(3);
    expect(result[1].slideNumber).toBe(1);
  });

  it("auto-selects when no numbers provided", () => {
    const slides = [
      makeManifestSlide({ slideNumber: 1, importance: "HIGH", includeInXTeaser: true }),
      makeManifestSlide({ slideNumber: 2, importance: "HIGH", includeInXTeaser: true }),
      makeManifestSlide({ slideNumber: 3, importance: "HIGH", includeInXTeaser: true }),
      makeManifestSlide({ slideNumber: 4, importance: "LOW", includeInXTeaser: false }),
    ];

    const result = selectTeaserSlides(slides);
    expect(result.length).toBe(3);
  });

  it("limits to max 6 slides", () => {
    const slides = Array.from({ length: 10 }, (_, i) =>
      makeManifestSlide({
        slideNumber: i + 1,
        importance: "HIGH",
        includeInXTeaser: true,
      }),
    );

    const result = selectTeaserSlides(slides);
    expect(result.length).toBe(6);
  });

  it("uses teaserNote for duration estimate when available", () => {
    const slides = [
      makeManifestSlide({
        slideNumber: 1,
        teaserNote: "This is a short note with about ten words total here.",
        measuredAudioMs: 8000,
      }),
    ];

    const result = selectTeaserSlides(slides, [1]);
    // "This is a short note with about ten words total here." = 11 words
    // 11 / 150 * 60 * 1000 = 4400ms
    expect(result[0].estimatedDurationMs).toBe(4400);
  });

  it("falls back to measuredAudioMs when teaserNote is empty", () => {
    const slides = [
      makeManifestSlide({
        slideNumber: 1,
        teaserNote: "",
        measuredAudioMs: 7500,
      }),
    ];

    const result = selectTeaserSlides(slides, [1]);
    expect(result[0].estimatedDurationMs).toBe(7500);
  });

  it("skips invalid slide numbers", () => {
    const slides = [
      makeManifestSlide({ slideNumber: 1 }),
      makeManifestSlide({ slideNumber: 2 }),
    ];

    const result = selectTeaserSlides(slides, [1, 99, 2]);
    expect(result.length).toBe(2);
    expect(result.map((s) => s.slideNumber)).toEqual([1, 2]);
  });
});
