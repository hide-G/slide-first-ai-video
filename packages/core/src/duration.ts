/**
 * Duration calculation utilities.
 *
 * From the design document:
 * - durationMs = measuredAudioMs + leadInMs + leadOutMs
 * - startMs = cumulative sum of previous slides' durationMs
 */

export interface SlideTiming {
  measuredAudioMs: number;
  leadInMs: number;
  leadOutMs: number;
}

export interface SlideTimingResult {
  durationMs: number;
  startMs: number;
}

/**
 * Calculate the total duration for a single slide.
 * durationMs = measuredAudioMs + leadInMs + leadOutMs
 */
export function calculateDurationMs(timing: SlideTiming): number {
  return timing.measuredAudioMs + timing.leadInMs + timing.leadOutMs;
}

/**
 * Calculate the start position for a slide given the cumulative duration of all preceding slides.
 */
export function calculateStartMs(precedingDurations: number[]): number {
  return precedingDurations.reduce((sum, d) => sum + d, 0);
}

/**
 * Calculate duration and start time for all slides.
 * Returns an array of { durationMs, startMs } for each slide.
 */
export function calculateSlideDurations(
  slides: SlideTiming[],
): SlideTimingResult[] {
  const results: SlideTimingResult[] = [];
  let cumulativeMs = 0;

  for (const slide of slides) {
    const durationMs = calculateDurationMs(slide);
    results.push({
      durationMs,
      startMs: cumulativeMs,
    });
    cumulativeMs += durationMs;
  }

  return results;
}
