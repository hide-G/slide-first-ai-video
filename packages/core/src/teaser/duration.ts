/**
 * Teaser duration calculation utilities.
 * Validates that selected slides fit within the 30-60 second target duration.
 */

import type { TeaserConfig, SelectedSlide } from "@slide-first/shared-types";

/** Default teaser configuration */
export const DEFAULT_TEASER_CONFIG: TeaserConfig = {
  minSlides: 3,
  maxSlides: 6,
  targetDurationMinSec: 30,
  targetDurationMaxSec: 60,
  hookCandidateCount: 3,
};

/** Hook overlay duration in milliseconds (first 2 seconds) */
const HOOK_DURATION_MS = 2000;

/** CTA duration in milliseconds (last 3 seconds) */
const CTA_DURATION_MS = 3000;

/**
 * Calculate total teaser duration from selected slides.
 * Includes hook overlay at the start and CTA at the end.
 */
export function calculateTeaserDuration(
  selectedSlides: SelectedSlide[],
  options?: { hookDurationMs?: number; ctaDurationMs?: number },
): number {
  const hookMs = options?.hookDurationMs ?? HOOK_DURATION_MS;
  const ctaMs = options?.ctaDurationMs ?? CTA_DURATION_MS;

  const slidesDurationMs = selectedSlides.reduce(
    (sum, slide) => sum + slide.estimatedDurationMs,
    0,
  );

  return hookMs + slidesDurationMs + ctaMs;
}

/**
 * Validate that the total duration falls within the target range.
 * Returns an object with valid flag and the total duration.
 */
export function validateTeaserDuration(
  selectedSlides: SelectedSlide[],
  config: TeaserConfig = DEFAULT_TEASER_CONFIG,
): { valid: boolean; totalDurationMs: number; reason?: string } {
  const totalDurationMs = calculateTeaserDuration(selectedSlides);
  const totalDurationSec = totalDurationMs / 1000;

  if (selectedSlides.length < config.minSlides) {
    return {
      valid: false,
      totalDurationMs,
      reason: `Too few slides: ${selectedSlides.length} (minimum ${config.minSlides})`,
    };
  }

  if (selectedSlides.length > config.maxSlides) {
    return {
      valid: false,
      totalDurationMs,
      reason: `Too many slides: ${selectedSlides.length} (maximum ${config.maxSlides})`,
    };
  }

  if (totalDurationSec < config.targetDurationMinSec) {
    return {
      valid: false,
      totalDurationMs,
      reason: `Duration too short: ${totalDurationSec.toFixed(1)}s (minimum ${config.targetDurationMinSec}s)`,
    };
  }

  if (totalDurationSec > config.targetDurationMaxSec) {
    return {
      valid: false,
      totalDurationMs,
      reason: `Duration too long: ${totalDurationSec.toFixed(1)}s (maximum ${config.targetDurationMaxSec}s)`,
    };
  }

  return { valid: true, totalDurationMs };
}
