/**
 * Presenter notes extraction module.
 * Parses Marpit-format notes (HTML comments after slide separators)
 * and returns structured array with slide metadata.
 */

import type { SlideImportance } from "@slide-first/shared-types";
import type { ParsedSlide, SlideMetadata } from "./parser.js";

/** Structured slide note with metadata */
export interface SlideNoteEntry {
  slideNumber: number;
  presenterNote: string;
  keyPoints: string[];
  importance: SlideImportance;
  teaserNote: string;
  includeInXTeaser: boolean;
}

/**
 * Extract structured notes from parsed slides and metadata.
 * Merges content from the parsed slides with the metadata JSON block.
 */
export function extractSlideNotes(
  slides: ParsedSlide[],
  metadata: SlideMetadata[],
): SlideNoteEntry[] {
  // Build metadata lookup by slide number
  const metadataMap = new Map<number, SlideMetadata>();
  for (const m of metadata) {
    metadataMap.set(m.slideNumber, m);
  }

  return slides.map((slide) => {
    const meta = metadataMap.get(slide.slideNumber);

    return {
      slideNumber: slide.slideNumber,
      presenterNote: slide.presenterNote,
      keyPoints: meta?.keyPoints ?? [],
      importance: (meta?.importance ?? "MEDIUM") as SlideImportance,
      teaserNote: meta?.teaserNote ?? "",
      includeInXTeaser: meta?.includeInXTeaser ?? false,
    };
  });
}
