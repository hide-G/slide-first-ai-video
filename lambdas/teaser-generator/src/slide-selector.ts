/**
 * Slide selection logic for teaser generation.
 * Filters by importance=HIGH and includeInXTeaser=true, limits to 3-6 slides,
 * ensures total duration fits within 30-60 seconds.
 */

import type { ManifestSlide, SelectedSlide } from "@slide-first/shared-types";
import { DEFAULT_TEASER_CONFIG } from "@slide-first/core";

/** Words per minute for estimating teaserNote reading time */
const WORDS_PER_MINUTE = 150;

/**
 * Estimate reading duration for a text in milliseconds.
 * Based on ~150 words per minute for narration.
 */
export function estimateReadingDurationMs(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  const wordCount = text.trim().split(/\s+/).length;
  return Math.round((wordCount / WORDS_PER_MINUTE) * 60 * 1000);
}

/**
 * Filter slides that are candidates for teaser inclusion.
 * Prioritizes HIGH importance slides that are marked for teaser.
 */
export function filterTeaserCandidates(slides: ManifestSlide[]): ManifestSlide[] {
  // Primary: HIGH importance AND includeInXTeaser
  const primary = slides.filter(
    (s) => s.importance === "HIGH" && s.includeInXTeaser,
  );

  // If we have enough primary candidates, return them
  if (primary.length >= DEFAULT_TEASER_CONFIG.minSlides) {
    return primary;
  }

  // Fallback: include MEDIUM importance slides marked for teaser
  const secondary = slides.filter(
    (s) => s.importance === "MEDIUM" && s.includeInXTeaser,
  );

  return [...primary, ...secondary];
}

/**
 * Select slides for the teaser video based on importance and duration constraints.
 * Uses the Bedrock-selected slide numbers when available, otherwise auto-selects.
 *
 * @param slides - All manifest slides
 * @param selectedNumbers - Slide numbers selected by Bedrock (optional)
 * @returns Selected slides with estimated durations
 */
export function selectTeaserSlides(
  slides: ManifestSlide[],
  selectedNumbers?: number[],
): SelectedSlide[] {
  let candidates: ManifestSlide[];

  if (selectedNumbers && selectedNumbers.length > 0) {
    // Use Bedrock-selected slides in the specified order
    candidates = selectedNumbers
      .map((num) => slides.find((s) => s.slideNumber === num))
      .filter((s): s is ManifestSlide => s !== undefined);
  } else {
    // Auto-select from filtered candidates
    candidates = filterTeaserCandidates(slides);
  }

  // Limit to max slides
  const limited = candidates.slice(0, DEFAULT_TEASER_CONFIG.maxSlides);

  // Convert to SelectedSlide with estimated durations
  return limited.map((slide) => ({
    slideNumber: slide.slideNumber,
    teaserNote: slide.teaserNote,
    keyPoints: slide.keyPoints,
    imageKey: slide.imageKey,
    estimatedDurationMs: slide.teaserNote
      ? estimateReadingDurationMs(slide.teaserNote)
      : slide.measuredAudioMs,
  }));
}
