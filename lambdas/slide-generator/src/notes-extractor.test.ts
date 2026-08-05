/**
 * Tests for notes extractor.
 */

import { describe, it, expect } from "vitest";
import { extractSlideNotes } from "./notes-extractor.js";
import type { ParsedSlide, SlideMetadata } from "./parser.js";

describe("extractSlideNotes", () => {
  it("merges slides with metadata correctly", () => {
    const slides: ParsedSlide[] = [
      { slideNumber: 1, content: "# Slide 1", presenterNote: "Note for slide 1" },
      { slideNumber: 2, content: "# Slide 2", presenterNote: "Note for slide 2" },
    ];
    const metadata: SlideMetadata[] = [
      {
        slideNumber: 1,
        keyPoints: ["Point A"],
        importance: "HIGH",
        teaserNote: "Teaser 1",
        includeInXTeaser: true,
      },
      {
        slideNumber: 2,
        keyPoints: ["Point B", "Point C"],
        importance: "MEDIUM",
        teaserNote: "Teaser 2",
        includeInXTeaser: false,
      },
    ];

    const result = extractSlideNotes(slides, metadata);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      slideNumber: 1,
      presenterNote: "Note for slide 1",
      keyPoints: ["Point A"],
      importance: "HIGH",
      teaserNote: "Teaser 1",
      includeInXTeaser: true,
    });
    expect(result[1]).toEqual({
      slideNumber: 2,
      presenterNote: "Note for slide 2",
      keyPoints: ["Point B", "Point C"],
      importance: "MEDIUM",
      teaserNote: "Teaser 2",
      includeInXTeaser: false,
    });
  });

  it("uses defaults when metadata is missing for a slide", () => {
    const slides: ParsedSlide[] = [
      { slideNumber: 1, content: "# Slide 1", presenterNote: "Note 1" },
      { slideNumber: 2, content: "# Slide 2", presenterNote: "Note 2" },
    ];
    const metadata: SlideMetadata[] = [
      {
        slideNumber: 1,
        keyPoints: ["Point"],
        importance: "HIGH",
        teaserNote: "Teaser",
        includeInXTeaser: true,
      },
      // No metadata for slide 2
    ];

    const result = extractSlideNotes(slides, metadata);

    expect(result[1]).toEqual({
      slideNumber: 2,
      presenterNote: "Note 2",
      keyPoints: [],
      importance: "MEDIUM",
      teaserNote: "",
      includeInXTeaser: false,
    });
  });

  it("handles empty metadata array", () => {
    const slides: ParsedSlide[] = [
      { slideNumber: 1, content: "# Only Slide", presenterNote: "Only note" },
    ];

    const result = extractSlideNotes(slides, []);

    expect(result).toHaveLength(1);
    expect(result[0].keyPoints).toEqual([]);
    expect(result[0].importance).toBe("MEDIUM");
  });

  it("preserves presenter notes from parsed slides", () => {
    const slides: ParsedSlide[] = [
      {
        slideNumber: 1,
        content: "Content",
        presenterNote: "Multi-line\nnote with\nseveral lines",
      },
    ];
    const metadata: SlideMetadata[] = [
      {
        slideNumber: 1,
        keyPoints: ["Key"],
        importance: "LOW",
        teaserNote: "T",
        includeInXTeaser: false,
      },
    ];

    const result = extractSlideNotes(slides, metadata);
    expect(result[0].presenterNote).toBe("Multi-line\nnote with\nseveral lines");
  });
});
