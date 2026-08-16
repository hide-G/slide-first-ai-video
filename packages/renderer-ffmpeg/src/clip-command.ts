/**
 * Builds FFmpeg arguments for creating a per-page video clip.
 *
 * Combines a still PNG image with an MP3 audio file into an MP4 clip.
 * Uses -t with measured audioDurationSec (rule 7.1 - without it clips are too long).
 * Uses execFile with array args, NEVER shell (rule 3.5).
 * Never embeds text in command args (rule 3.5).
 */

export interface ClipCommandOptions {
  /** Path to the input PNG image */
  imagePath: string;
  /** Path to the input MP3 audio */
  audioPath: string;
  /** Measured audio duration in seconds (from ffprobe) */
  audioDurationSec: number;
  /** Output MP4 path */
  outputPath: string;
  /** Video width (default: 1920) */
  width?: number;
  /** Video height (default: 1080) */
  height?: number;
  /** Frame rate (default: 30) */
  fps?: number;
}

/**
 * Build FFmpeg arguments for creating a single page clip.
 *
 * Command structure:
 *   ffmpeg -y -loop 1 -i page.png -i page.mp3 -t {audioDurationSec}
 *     -c:v libx264 -tune stillimage -pix_fmt yuv420p
 *     -vf "scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2"
 *     -r {fps} -c:a aac -b:a 96k -ar 24000 -shortest page.mp4
 */
export function buildClipArgs(options: ClipCommandOptions): string[] {
  const {
    imagePath,
    audioPath,
    audioDurationSec,
    outputPath,
    width = 1920,
    height = 1080,
    fps = 30,
  } = options;

  const vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;

  return [
    "-y",
    "-loop", "1",
    "-i", imagePath,
    "-i", audioPath,
    "-t", audioDurationSec.toFixed(3),
    "-c:v", "libx264",
    "-tune", "stillimage",
    "-pix_fmt", "yuv420p",
    "-vf", vf,
    "-r", String(fps),
    "-c:a", "aac",
    "-b:a", "96k",
    "-ar", "24000",
    "-shortest",
    outputPath,
  ];
}
