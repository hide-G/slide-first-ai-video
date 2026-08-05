/**
 * Timing resolver: computes durationMs and cumulative startMs for slides.
 *
 * Given an array of slide data with measuredAudioMs, leadInMs, leadOutMs,
 * calculates durationMs for each slide and cumulative startMs.
 * Validates that no gaps or overlaps exist (each slide's startMs equals the
 * sum of all preceding durations).
 */

export interface SlideTimingInput {
  measuredAudioMs: number;
  leadInMs?: number;
  leadOutMs?: number;
}

export interface ResolvedTiming {
  measuredAudioMs: number;
  leadInMs: number;
  leadOutMs: number;
  durationMs: number;
  startMs: number;
}

const DEFAULT_LEAD_IN_MS = 120;
const DEFAULT_LEAD_OUT_MS = 400;

/**
 * Resolve timings for all slides.
 * Each slide's durationMs = measuredAudioMs + leadInMs + leadOutMs.
 * Each slide's startMs = sum of all preceding durationMs values.
 *
 * This guarantees no gaps or overlaps by construction.
 */
export function resolveTimings(slides: SlideTimingInput[]): ResolvedTiming[] {
  const results: ResolvedTiming[] = [];
  let cumulativeMs = 0;

  for (const slide of slides) {
    const leadInMs = slide.leadInMs ?? DEFAULT_LEAD_IN_MS;
    const leadOutMs = slide.leadOutMs ?? DEFAULT_LEAD_OUT_MS;
    const durationMs = slide.measuredAudioMs + leadInMs + leadOutMs;

    results.push({
      measuredAudioMs: slide.measuredAudioMs,
      leadInMs,
      leadOutMs,
      durationMs,
      startMs: cumulativeMs,
    });

    cumulativeMs += durationMs;
  }

  return results;
}

/**
 * Validate that resolved timings have no gaps or overlaps.
 * Returns true if valid, throws on invalid state.
 */
export function validateTimings(timings: ResolvedTiming[]): boolean {
  let expectedStart = 0;

  for (let i = 0; i < timings.length; i++) {
    const t = timings[i];
    if (t.startMs !== expectedStart) {
      throw new Error(
        `Timing gap/overlap at slide ${i}: expected startMs=${expectedStart}, got ${t.startMs}`,
      );
    }
    expectedStart += t.durationMs;
  }

  return true;
}
