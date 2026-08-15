import { describe, it, expect } from "vitest";
import type { SelectedSlide, TeaserConfig } from "@slide-first/shared-types";
import {
  calculateTeaserDuration,
  validateTeaserDuration,
  DEFAULT_TEASER_CONFIG,
} from "./duration.js";
import {
  calculateSlideCardLayout,
  SLIDE_CARD_DIMENSIONS,
} from "./slide-card.js";

function makeSlide(durationMs: number, slideNumber: number = 1): SelectedSlide {
  return {
    slideNumber,
    teaserNote: `Test note for slide ${slideNumber}`,
    keyPoints: ["point 1", "point 2"],
    imageKey: `slides/slide-${slideNumber}.png`,
    estimatedDurationMs: durationMs,
  };
}

describe("calculateTeaserDuration", () => {
  it("calculates total duration with default hook and CTA", () => {
    const slides = [makeSlide(8000, 1), makeSlide(8000, 2), makeSlide(8000, 3)];
    // 2000 (hook) + 24000 (slides) + 3000 (CTA) = 29000
    expect(calculateTeaserDuration(slides)).toBe(29000);
  });

  it("calculates with custom hook and CTA durations", () => {
    const slides = [makeSlide(10000, 1), makeSlide(10000, 2), makeSlide(10000, 3)];
    const result = calculateTeaserDuration(slides, {
      hookDurationMs: 1500,
      ctaDurationMs: 2500,
    });
    // 1500 + 30000 + 2500 = 34000
    expect(result).toBe(34000);
  });

  it("returns hook + CTA duration for empty slides", () => {
    expect(calculateTeaserDuration([])).toBe(5000);
  });
});

describe("validateTeaserDuration", () => {
  it("validates a good teaser within 30-60s range", () => {
    // 3 slides at 10s each = 30s + 5s (hook+CTA) = 35s total
    const slides = [makeSlide(10000, 1), makeSlide(10000, 2), makeSlide(10000, 3)];
    const result = validateTeaserDuration(slides);
    expect(result.valid).toBe(true);
    expect(result.totalDurationMs).toBe(35000);
  });

  it("rejects too few slides", () => {
    const slides = [makeSlide(15000, 1), makeSlide(15000, 2)];
    const result = validateTeaserDuration(slides);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Too few slides");
  });

  it("rejects too many slides", () => {
    const slides = Array.from({ length: 7 }, (_, i) => makeSlide(5000, i + 1));
    const result = validateTeaserDuration(slides);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Too many slides");
  });

  it("rejects duration too short", () => {
    const slides = [makeSlide(3000, 1), makeSlide(3000, 2), makeSlide(3000, 3)];
    // 2000 + 9000 + 3000 = 14000ms = 14s (too short)
    const result = validateTeaserDuration(slides);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Duration too short");
  });

  it("rejects duration too long", () => {
    const slides = [
      makeSlide(15000, 1),
      makeSlide(15000, 2),
      makeSlide(15000, 3),
      makeSlide(15000, 4),
    ];
    // 2000 + 60000 + 3000 = 65000ms = 65s (too long)
    const result = validateTeaserDuration(slides);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Duration too long");
  });

  it("accepts custom config", () => {
    const config: TeaserConfig = {
      minSlides: 2,
      maxSlides: 4,
      targetDurationMinSec: 20,
      targetDurationMaxSec: 90,
      hookCandidateCount: 3,
    };
    const slides = [makeSlide(10000, 1), makeSlide(10000, 2)];
    const result = validateTeaserDuration(slides, config);
    expect(result.valid).toBe(true);
  });

  it("DEFAULT_TEASER_CONFIG has expected values", () => {
    expect(DEFAULT_TEASER_CONFIG.minSlides).toBe(3);
    expect(DEFAULT_TEASER_CONFIG.maxSlides).toBe(6);
    expect(DEFAULT_TEASER_CONFIG.targetDurationMinSec).toBe(30);
    expect(DEFAULT_TEASER_CONFIG.targetDurationMaxSec).toBe(60);
    expect(DEFAULT_TEASER_CONFIG.hookCandidateCount).toBe(3);
  });
});

describe("calculateSlideCardLayout", () => {
  it("returns correct dimensions for default 1080x1920", () => {
    const layout = calculateSlideCardLayout();
    expect(layout.width).toBe(1080);
    expect(layout.height).toBe(1920);
  });

  it("slide area occupies top 60%", () => {
    const layout = calculateSlideCardLayout();
    // 1920 * 0.6 = 1152
    expect(layout.slideArea.width).toBe(1080);
    // 16:9 at 1080 width = 607.5, rounded = 608
    expect(layout.slideArea.height).toBe(608);
  });

  it("caption area starts at 60% height", () => {
    const layout = calculateSlideCardLayout();
    // 1920 * 0.6 = 1152
    expect(layout.captionArea.top).toBe(1152);
  });

  it("caption area has padding on sides", () => {
    const layout = calculateSlideCardLayout();
    expect(layout.captionArea.left).toBe(SLIDE_CARD_DIMENSIONS.captionPadding);
    expect(layout.captionArea.width).toBe(
      1080 - SLIDE_CARD_DIMENSIONS.captionPadding * 2,
    );
  });

  it("slide image is centered vertically in slide area", () => {
    const layout = calculateSlideCardLayout();
    const slideAreaHeight = Math.round(1920 * 0.6); // 1152
    const slideImageHeight = Math.round(1080 / (16 / 9)); // 608
    const expectedTop = Math.round((slideAreaHeight - slideImageHeight) / 2); // 272
    expect(layout.slideArea.top).toBe(expectedTop);
  });

  it("works with custom dimensions", () => {
    const layout = calculateSlideCardLayout(720, 1280);
    expect(layout.width).toBe(720);
    expect(layout.height).toBe(1280);
    expect(layout.slideArea.width).toBe(720);
  });
});
