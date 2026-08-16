/**
 * SRT (SubRip) caption generator for the new pipeline.
 *
 * Generates captions from ManifestPage[] using cumulative audioDurationSec
 * to calculate timing. Each page gets one SRT entry with its script text.
 *
 * SRT format:
 * 1
 * HH:MM:SS,mmm --> HH:MM:SS,mmm
 * Caption text
 */

import type { Page } from "@slide-first/shared-types";
import { calculatePageTimings } from "../duration.js";

/**
 * Format seconds to SRT timestamp: HH:MM:SS,mmm
 */
export function formatSrtTimestamp(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;

  return (
    `${String(hours).padStart(2, "0")}:` +
    `${String(minutes).padStart(2, "0")}:` +
    `${String(secs).padStart(2, "0")},` +
    `${String(ms).padStart(3, "0")}`
  );
}

/**
 * Generate SRT content from manifest pages.
 *
 * Each page becomes one subtitle entry, timed from its cumulative start
 * to its cumulative end (start + audioDurationSec).
 */
export function generateSrt(
  pages: Pick<Page, "pageNumber" | "audioDurationSec" | "script">[],
): string {
  if (pages.length === 0) {
    return "";
  }

  const timings = calculatePageTimings(
    pages.map((p) => ({ pageNumber: p.pageNumber, audioDurationSec: p.audioDurationSec })),
  );

  const blocks: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const timing = timings[i];
    const startTime = formatSrtTimestamp(timing.startSec);
    const endTime = formatSrtTimestamp(timing.endSec);
    const text = page.script.text.trim();

    if (text.length === 0) {
      continue;
    }

    blocks.push(`${blocks.length + 1}\n${startTime} --> ${endTime}\n${text}`);
  }

  if (blocks.length === 0) {
    return "";
  }

  return blocks.join("\n\n") + "\n";
}
