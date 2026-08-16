/**
 * Builds ffprobe arguments for measuring audio/video duration.
 *
 * Uses execFile with array args, NEVER shell (rule 3.5).
 */

/**
 * Build ffprobe arguments for measuring file duration.
 *   ffprobe -v error -show_entries format=duration -of csv=p=0 file.mp3
 */
export function buildProbeArgs(filePath: string): string[] {
  return [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "csv=p=0",
    filePath,
  ];
}

/**
 * Parse the stdout from ffprobe to extract duration in seconds.
 * ffprobe outputs a single line with a float, e.g. "12.345\n"
 */
export function parseProbeDuration(stdout: string): number {
  const trimmed = stdout.trim();
  const duration = parseFloat(trimmed);
  if (isNaN(duration) || duration < 0) {
    throw new Error(`Failed to parse ffprobe duration: "${trimmed}"`);
  }
  return duration;
}
