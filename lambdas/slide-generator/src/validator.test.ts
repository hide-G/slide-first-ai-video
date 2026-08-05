/**
 * Tests for slide validation.
 */

import { describe, it, expect } from "vitest";
import { validateSlides, MAX_PRESENTER_NOTE_CHARS } from "./validator.js";
import type { ParsedSlide, SlideMetadata } from "./parser.js";

function makeSlide(slideNumber: number, presenterNote: string, content = "# Slide"): ParsedSlide {
  return { slideNumber, content, presenterNote };
}

function makeMetadata(slideNumber: number, keyPoints: string[] = ["Point 1"]): SlideMetadata {
  return {
    slideNumber,
    keyPoints,
    importance: "MEDIUM",
    teaserNote: "Teaser",
    includeInXTeaser: false,
  };
}

describe("validateSlides", () => {
  it("passes valid slides", () => {
    const slides = [
      makeSlide(1, "Note for slide 1"),
      makeSlide(2, "Note for slide 2"),
      makeSlide(3, "Note for slide 3"),
    ];
    const metadata = [makeMetadata(1), makeMetadata(2), makeMetadata(3)];

    const result = validateSlides(slides, metadata, "marp: true\ntheme: default", 1);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects slides without presenter notes", () => {
    const slides = [makeSlide(1, ""), makeSlide(2, "Has a note")];
    const metadata = [makeMetadata(1), makeMetadata(2)];

    const result = validateSlides(slides, metadata, "marp: true", 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.slideNumber === 1 && e.field === "presenterNote")).toBe(
      true,
    );
  });

  it("rejects slides with presenter notes exceeding 3000 chars", () => {
    const longNote = "x".repeat(MAX_PRESENTER_NOTE_CHARS + 1);
    const slides = [makeSlide(1, longNote)];
    const metadata = [makeMetadata(1)];

    const result = validateSlides(slides, metadata, "marp: true", 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "presenterNote" && e.message.includes("3000")))
      .toBe(true);
  });

  it("accepts presenter notes at exactly 3000 chars", () => {
    const exactNote = "x".repeat(MAX_PRESENTER_NOTE_CHARS);
    const slides = [makeSlide(1, exactNote)];
    const metadata = [makeMetadata(1)];

    const result = validateSlides(slides, metadata, "marp: true", 1);
    expect(result.valid).toBe(true);
  });

  it("rejects slides without keyPoints", () => {
    const slides = [makeSlide(1, "A note")];
    const metadata = [
      {
        slideNumber: 1,
        keyPoints: [],
        importance: "MEDIUM" as const,
        teaserNote: "Teaser",
        includeInXTeaser: false,
      },
    ];

    const result = validateSlides(slides, metadata, "marp: true", 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "keyPoints")).toBe(true);
  });

  it("rejects missing metadata for a slide", () => {
    const slides = [makeSlide(1, "Note 1"), makeSlide(2, "Note 2")];
    const metadata = [makeMetadata(1)]; // Missing metadata for slide 2

    const result = validateSlides(slides, metadata, "marp: true", 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.slideNumber === 2 && e.field === "metadata")).toBe(true);
  });

  it("rejects missing frontmatter", () => {
    const slides = [makeSlide(1, "Note")];
    const metadata = [makeMetadata(1)];

    const result = validateSlides(slides, metadata, "", 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "frontmatter")).toBe(true);
  });

  it("rejects frontmatter without marp field", () => {
    const slides = [makeSlide(1, "Note")];
    const metadata = [makeMetadata(1)];

    const result = validateSlides(slides, metadata, "theme: default\npaginate: true", 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "frontmatter")).toBe(true);
  });

  it("warns about slide count below expected range", () => {
    // 5 minutes = 300 seconds. At 20s/slide, min is 15 slides.
    const slides = [makeSlide(1, "Note")];
    const metadata = [makeMetadata(1)];

    const result = validateSlides(slides, metadata, "marp: true", 5);
    // Should produce a warning (not error) about low slide count
    expect(result.warnings.some((w) => w.field === "slideCount")).toBe(true);
  });

  it("errors when slide count far exceeds maximum", () => {
    // 1 minute = 60 seconds. At 15s/slide max is 4. 4*1.5 = 6.
    const slides = Array.from({ length: 10 }, (_, i) => makeSlide(i + 1, "Note"));
    const metadata = Array.from({ length: 10 }, (_, i) => makeMetadata(i + 1));

    const result = validateSlides(slides, metadata, "marp: true", 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "slideCount")).toBe(true);
  });

  it("warns about oversized slide content", () => {
    const bigContent = "x".repeat(2000);
    const slides = [makeSlide(1, "Note", bigContent)];
    const metadata = [makeMetadata(1)];

    const result = validateSlides(slides, metadata, "marp: true", 1);
    // Content overflow is a warning, not an error
    expect(result.warnings.some((w) => w.field === "content")).toBe(true);
  });
});
