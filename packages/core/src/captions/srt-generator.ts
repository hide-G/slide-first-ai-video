/**
 * SubRip (SRT) format generator.
 *
 * Format:
 * 1
 * HH:MM:SS,mmm --> HH:MM:SS,mmm
 * Caption text
 *
 * 2
 * HH:MM:SS,mmm --> HH:MM:SS,mmm
 * Caption text
 */

import type { CaptionSegment } from "./caption-builder.js";

/**
 * Format milliseconds to SRT timestamp: HH:MM:SS,mmm (comma, not dot)
 */
export function formatSrtTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor(ms % 1000);

  return (
    `${String(hours).padStart(2, "0")}:` +
    `${String(minutes).padStart(2, "0")}:` +
    `${String(seconds).padStart(2, "0")},` +
    `${String(milliseconds).padStart(3, "0")}`
  );
}

/**
 * Generate SRT content from caption segments.
 */
export function generateSrt(segments: CaptionSegment[]): string {
  const blocks: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const startTime = formatSrtTimestamp(seg.startMs);
    const endTime = formatSrtTimestamp(seg.endMs);

    blocks.push(
      `${String(i + 1)}\n${startTime} --> ${endTime}\n${seg.text}`,
    );
  }

  return blocks.join("\n\n") + "\n";
}
