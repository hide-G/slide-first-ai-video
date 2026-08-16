/**
 * Duration calculation utilities for the new pipeline model.
 *
 * In the new architecture:
 * - Each page has an audioDurationSec (float, measured by ffprobe)
 * - Total video duration = sum of all audioDurationSec values
 * - Each page's start time = cumulative sum of preceding pages' audioDurationSec
 *
 * All values are in seconds (not milliseconds).
 */

import type { Page } from "@slide-first/shared-types";

export interface PageTiming {
  pageNumber: number;
  audioDurationSec: number;
  startSec: number;
  endSec: number;
}

/**
 * Calculate the total duration of all pages in seconds.
 */
export function totalDurationSec(pages: Pick<Page, "audioDurationSec">[]): number {
  return pages.reduce((sum, page) => sum + page.audioDurationSec, 0);
}

/**
 * Calculate cumulative timings for all pages.
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
