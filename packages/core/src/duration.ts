/**
 * Duration calculation utilities for the pipeline.
 *
 * In the new architecture:
 * - Each page has an audioDurationSec (calculated from PCM byte length)
 * - Each page has a frameAlignedDurationMs (ceil to frame boundary)
 * - Subtitle timecodes use cumulative frameAlignedDurationMs
 * - Total video duration = sum of all frameAlignedDurationMs values
 */

import type { Page } from "@slide-first/shared-types";

export interface PageTiming {
  pageNumber: number;
  audioDurationSec: number;
  startSec: number;
  endSec: number;
}

export interface FrameAlignedTiming {
  pageNumber: number;
  frameAlignedDurationMs: number;
  startSec: number;
  endSec: number;
}

/**
 * Calculate the total duration of all pages in seconds (from audioDurationSec).
 */
export function totalDurationSec(pages: Pick<Page, "audioDurationSec">[]): number {
  return pages.reduce((sum, page) => sum + page.audioDurationSec, 0);
}

/**
 * Calculate cumulative timings for all pages using audioDurationSec.
 * Returns an array with startSec and endSec for each page.
 */
export function calculatePageTimings(
  pages: Pick<Page, "pageNumber" | "audioDurationSec">[],
): PageTiming[] {
  const timings: PageTiming[] = [];
  let cumulative = 0;

  for (const page of pages) {
    const startSec = cumulative;
    const endSec = cumulative + page.audioDurationSec;
    timings.push({
      pageNumber: page.pageNumber,
      audioDurationSec: page.audioDurationSec,
      startSec,
      endSec,
    });
    cumulative = endSec;
  }

  return timings;
}

/**
 * Calculate cumulative timings using frameAlignedDurationMs.
 * This is used for SRT timecodes to ensure alignment with video frames.
 */
export function calculateFrameAlignedTimings(
  pages: Pick<Page, "pageNumber" | "frameAlignedDurationMs">[],
): FrameAlignedTiming[] {
  const timings: FrameAlignedTiming[] = [];
  let cumulativeMs = 0;

  for (const page of pages) {
    const startSec = cumulativeMs / 1000;
    const endSec = (cumulativeMs + page.frameAlignedDurationMs) / 1000;
    timings.push({
      pageNumber: page.pageNumber,
      frameAlignedDurationMs: page.frameAlignedDurationMs,
      startSec,
      endSec,
    });
    cumulativeMs += page.frameAlignedDurationMs;
  }

  return timings;
}

/**
 * Calculate total frame-aligned duration in milliseconds.
 */
export function totalFrameAlignedDurationMs(
  pages: Pick<Page, "frameAlignedDurationMs">[],
): number {
  return pages.reduce((sum, page) => sum + page.frameAlignedDurationMs, 0);
}

/**
 * Get the start time in seconds for a specific page index (0-based).
 */
export function pageStartSec(
  pages: Pick<Page, "audioDurationSec">[],
  pageIndex: number,
): number {
  let cumulative = 0;
  for (let i = 0; i < pageIndex && i < pages.length; i++) {
    cumulative += pages[i].audioDurationSec;
  }
  return cumulative;
}
