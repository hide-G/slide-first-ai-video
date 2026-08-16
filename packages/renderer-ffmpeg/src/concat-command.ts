/**
 * Builds FFmpeg arguments for concatenating clips into the final video.
 *
 * Two modes:
 * 1. With subtitle burn: uses -vf "subtitles=captions.srt" (NEVER drawtext, rule 3.5)
 * 2. Without subtitles (copy mode): uses -c copy for fast concatenation
 *
 * Uses ffmpeg concat demuxer with a list file.
 * Uses execFile with array args, NEVER shell (rule 3.5).
 */

export interface ConcatCommandOptions {
  /** Path to the concat list file */
  concatListPath: string;
  /** Output MP4 path */
  outputPath: string;
  /** Captions mode: 'burn' applies subtitles filter, others use stream copy */
  captionsMode: "burn" | "srt" | "none";
  /** Path to SRT file (required when captionsMode is 'burn') */
  srtPath?: string;
}

/**
 * Build FFmpeg arguments for concatenating clips.
 *
 * When captionsMode='burn':
 *   ffmpeg -y -f concat -safe 0 -i list.txt -vf "subtitles=captions.srt" -c:v libx264 -c:a aac -b:a 96k output.mp4
 *
 * When captionsMode='srt' or 'none':
 *   ffmpeg -y -f concat -safe 0 -i list.txt -c copy output.mp4
 */
export function buildConcatArgs(options: ConcatCommandOptions): string[] {
  const { concatListPath, outputPath, captionsMode, srtPath } = options;

  const args: string[] = [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concatListPath,
  ];

  if (captionsMode === "burn") {
    if (!srtPath) {
      throw new Error("srtPath is required when captionsMode is 'burn'");
    }
    args.push("-vf", `subtitles=${escapeFfmpegPath(srtPath)}`);
    args.push("-c:v", "libx264");
    args.push("-c:a", "aac");
    args.push("-b:a", "96k");
  } else {
    args.push("-c", "copy");
  }

  args.push(outputPath);
  return args;
}

/**
 * Generate the content for the concat list file.
 * Each line is: file 'path/to/clip.mp4'
 */
export function buildConcatListContent(clipPaths: string[]): string {
  return clipPaths.map((p) => `file '${p}'`).join("\n") + "\n";
}

/**
 * Escape a file path for use in FFmpeg's subtitles filter.
 *
 * FFmpeg filter syntax uses ':', '[', ']', ';', and "'" as metacharacters.
 * The subtitles filter accepts a path wrapped in single quotes with
 * internal single quotes escaped as "'\\''".
 * Additionally, colons, backslashes, brackets, and semicolons inside the
 * quoted path must be escaped with a backslash.
 */
export function escapeFfmpegPath(path: string): string {
  // Escape special characters for FFmpeg filter graph:
  // backslash, colon, single quote, semicolons, brackets
  const escaped = path
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "'\\\\''")
    .replace(/:/g, "\\:")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/;/g, "\\;");
  return `'${escaped}'`;
}

/**
 * Build FFmpeg arguments for the decode check (integrity validation).
 *   ffmpeg -v error -i output.mp4 -map 0 -f null -
 */
export function buildDecodeCheckArgs(inputPath: string): string[] {
  return [
    "-v", "error",
    "-i", inputPath,
    "-map", "0",
    "-f", "null",
    "-",
  ];
}
