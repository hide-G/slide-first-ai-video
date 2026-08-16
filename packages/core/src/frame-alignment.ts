/**
 * Frame alignment utilities for MediaConvert-compatible timing.
 *
 * All durations must be aligned to frame boundaries so that
 * video frames and audio segments remain in sync.
 */

/**
 * Align a duration in milliseconds to the nearest frame boundary (rounded up).
 *
 * Formula:
 *   frameMs = 1000 * framerateDenominator / framerateNumerator
 *   frames  = Math.ceil(durationMs / frameMs)
 *   result  = Math.round(frames * frameMs)
 *
 * @param audioDurationMs - Audio duration in milliseconds
 * @param fps - Frames per second (e.g. 30)
 * @returns Duration in milliseconds aligned to the next frame boundary
 */
export function alignToFrame(audioDurationMs: number, fps: number): number {
  const frameMs = 1000 / fps;
  const frames = Math.ceil(audioDurationMs / frameMs);
  return Math.round(frames * frameMs);
}

/**
 * Convenience wrapper that accepts duration in seconds.
 *
 * @param audioDurationSec - Audio duration in seconds
 * @param fps - Frames per second (e.g. 30)
 * @returns Duration in milliseconds aligned to the next frame boundary
 */
export function alignToFrameFromSec(audioDurationSec: number, fps: number): number {
  return alignToFrame(audioDurationSec * 1000, fps);
}
