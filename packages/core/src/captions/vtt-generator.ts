/**
 * WebVTT format generator.
 *
 * Format:
 * WEBVTT
 *
 * 1
 * HH:MM:SS.mmm --> HH:MM:SS.mmm
 * Caption text
 *
 * 2
 * HH:MM:SS.mmm --> HH:MM:SS.mmm
 * Caption text
 */

import type { CaptionSegment } from "./caption-builder.js";

/**
 * Format milliseconds to VTT timestamp: HH:MM:SS.mmm
 */
export function formatVttTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor(ms % 1000);

  return (
    `${String(hours).padStart(2, "0")}:` +
    `${String(minutes).padStart(2, "0")}:` +
    `${String(seconds).padStart(2, "0")}.` +
    `${String(milliseconds).padStart(3, "0")}`
  );
}

/**
 * Generate WebVTT content from caption segments.
 */
export function generateVtt(segments: CaptionSegment[]): string {
  let output = "WEBVTT\n\n";

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const startTime = formatVttTimestamp(seg.startMs);
    const endTime = formatVttTimestamp(seg.endMs);

    output += `${String(i + 1)}\n`;
    output += `${startTime} --> ${endTime}\n`;
    output += `${seg.text}\n`;
    output += "\n";
  }

  return output;
}
