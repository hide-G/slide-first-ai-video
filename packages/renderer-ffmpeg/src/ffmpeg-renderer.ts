import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  VideoRenderer,
  RenderInput,
  RenderPlan,
  ChunkResult,
  RenderOutput,
} from "@slide-first/renderer-port";
import type { VideoManifest } from "@slide-first/shared-types";

const execFileAsync = promisify(execFile);

/** Default configuration for ffmpeg rendering */
const DEFAULTS = {
  fps: 30,
  width: 1920,
  height: 1080,
  videoBitrateKbps: 5000,
  /** Maximum slides per chunk for parallel rendering */
  maxSlidesPerChunk: 5,
} as const;

export interface FfmpegRendererOptions {
  /** Function to fetch the manifest JSON from S3. Required dependency injection. */
  fetchManifest: (bucket: string, key: string) => Promise<VideoManifest>;
  /** Function to resolve an S3 key to a local file path for ffmpeg processing */
  resolveS3Path: (bucket: string, key: string) => string;
  /** Path to the ffmpeg binary. Defaults to "ffmpeg". */
  ffmpegPath?: string;
}

/**
 * FFmpeg-based VideoRenderer implementation.
 * Uses child_process.execFile to call ffmpeg for video encoding.
 * Constructs commands: -loop 1 -t {duration} for PNGs, -f s16le -ar 24000 -ac 1 for PCM audio,
 * libx264 output at 1920x1080 30fps.
 */
export class FfmpegRenderer implements VideoRenderer {
  private readonly fetchManifest: FfmpegRendererOptions["fetchManifest"];
  private readonly resolveS3Path: FfmpegRendererOptions["resolveS3Path"];
  private readonly ffmpegPath: string;

  constructor(options: FfmpegRendererOptions) {
    this.fetchManifest = options.fetchManifest;
    this.resolveS3Path = options.resolveS3Path;
    this.ffmpegPath = options.ffmpegPath ?? "ffmpeg";
  }

  async plan(input: RenderInput): Promise<RenderPlan> {
    const manifest = await this.fetchManifest(input.bucket, input.manifestKey);
    const outputConfig = manifest.outputs[input.outputType];

    const fps = outputConfig?.fps ?? DEFAULTS.fps;
    const width = outputConfig?.width ?? DEFAULTS.width;
    const height = outputConfig?.height ?? DEFAULTS.height;
    const videoBitrateKbps =
      outputConfig?.videoBitrateKbps ?? DEFAULTS.videoBitrateKbps;

    // Calculate total frames from slide durations
    const totalDurationMs = manifest.slides.reduce(
      (sum, slide) => sum + slide.durationMs,
      0,
    );
    const totalFrames = Math.ceil((totalDurationMs * fps) / 1000);

    // Divide slides into chunks
    const chunkCount = Math.max(
      1,
      Math.ceil(manifest.slides.length / DEFAULTS.maxSlidesPerChunk),
    );

    // Build intermediate prefix from manifest key
    const manifestDir = input.manifestKey.replace(/\/[^/]+$/, "");
    const intermediatePrefix = `${manifestDir}/intermediate/${input.outputType}`;

    return {
      totalFrames,
      chunkCount,
      fps,
      width,
      height,
      videoBitrateKbps,
      intermediatePrefix,
      input,
      chunks: Array.from({ length: chunkCount }, (_, i) => ({
        plan: {
          totalFrames,
          chunkCount,
          fps,
          width,
          height,
          videoBitrateKbps,
          intermediatePrefix,
          input,
        },
        chunkIndex: i,
      })),
    };
  }

  async renderChunk(plan: RenderPlan, chunkIndex: number): Promise<ChunkResult> {
    const manifest = await this.fetchManifest(
      plan.input.bucket,
      plan.input.manifestKey,
    );

    // Divide slides into chunks
    const slidesPerChunk = Math.ceil(
      manifest.slides.length / plan.chunkCount,
    );
    const startSlide = chunkIndex * slidesPerChunk;
    const endSlide = Math.min(
      startSlide + slidesPerChunk,
      manifest.slides.length,
    );
    const chunkSlides = manifest.slides.slice(startSlide, endSlide);

    if (chunkSlides.length === 0) {
      throw new Error(
        `Chunk index ${chunkIndex} is out of range (total chunks: ${plan.chunkCount})`,
      );
    }

    // Build ffmpeg command for this chunk
    const args = this.buildChunkArgs(plan, chunkSlides, chunkIndex);
    const outputKey = `${plan.intermediatePrefix}/chunk-${String(chunkIndex).padStart(3, "0")}.mp4`;

    await execFileAsync(this.ffmpegPath, args);

    // Calculate frames for this chunk
    const chunkDurationMs = chunkSlides.reduce(
      (sum, slide) => sum + slide.durationMs,
      0,
    );
    const frameCount = Math.ceil((chunkDurationMs * plan.fps) / 1000);

    return {
      chunkIndex,
      artifactKey: outputKey,
      frameCount,
    };
  }

  async assemble(plan: RenderPlan, chunks: ChunkResult[]): Promise<RenderOutput> {
    const sortedChunks = [...chunks].sort(
      (a, b) => a.chunkIndex - b.chunkIndex,
    );
    const outputKey = `${plan.intermediatePrefix}/final.mp4`;

    // Build concat + audio mix command
    const args = this.buildAssembleArgs(plan, sortedChunks, outputKey);
    await execFileAsync(this.ffmpegPath, args);

    const totalFrames = sortedChunks.reduce(
      (sum, c) => sum + c.frameCount,
      0,
    );
    const durationMs = Math.round((totalFrames / plan.fps) * 1000);

    return {
      outputKey,
      durationMs,
      totalFrames,
    };
  }

  /**
   * Build ffmpeg arguments for rendering a chunk of slides into a video segment.
   * Each slide uses: -loop 1 -t {duration} -i {png}
   * PCM audio uses: -f s16le -ar 24000 -ac 1 -i {pcm}
   */
  buildChunkArgs(
    plan: RenderPlan,
    slides: readonly { imageKey: string; voiceKey: string; durationMs: number }[],
    chunkIndex: number,
  ): string[] {
    const args: string[] = ["-y"];
    const filterParts: string[] = [];
    let inputIndex = 0;

    // Add inputs for each slide (image + audio)
    for (const slide of slides) {
      const durationSec = slide.durationMs / 1000;
      const imagePath = this.resolveS3Path(plan.input.bucket, slide.imageKey);
      const audioPath = this.resolveS3Path(plan.input.bucket, slide.voiceKey);

      // Image input: loop for slide duration
      args.push(
        "-loop",
        "1",
        "-t",
        durationSec.toFixed(3),
        "-i",
        imagePath,
      );
      const imgIdx = inputIndex++;

      // Audio input: raw PCM s16le 24kHz mono
      args.push(
        "-f",
        "s16le",
        "-ar",
        "24000",
        "-ac",
        "1",
        "-i",
        audioPath,
      );
      const audIdx = inputIndex++;

      // Filter for this slide: scale image and pair with audio
      filterParts.push(
        `[${imgIdx}:v]scale=${plan.width}:${plan.height}:force_original_aspect_ratio=decrease,pad=${plan.width}:${plan.height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${plan.fps}[v${imgIdx}]`,
      );
      filterParts.push(`[${audIdx}:a]aresample=async=1[a${audIdx}]`);
    }

    // Concatenate all slide segments
    const videoStreams = slides
      .map((_, i) => `[v${i * 2}]`)
      .join("");
    const audioStreams = slides
      .map((_, i) => `[a${i * 2 + 1}]`)
      .join("");

    filterParts.push(
      `${videoStreams}${audioStreams}concat=n=${slides.length}:v=1:a=1[outv][outa]`,
    );

    args.push("-filter_complex", filterParts.join(";"));
    args.push("-map", "[outv]", "-map", "[outa]");

    // Output encoding
    args.push(
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(plan.fps),
      "-b:v",
      `${plan.videoBitrateKbps}k`,
      "-c:a",
      "aac",
      "-b:a",
      "128k",
    );

    const outputPath = this.resolveS3Path(
      plan.input.bucket,
      `${plan.intermediatePrefix}/chunk-${String(chunkIndex).padStart(3, "0")}.mp4`,
    );
    args.push(outputPath);

    return args;
  }

  /**
   * Build ffmpeg arguments for assembling chunks into the final output.
   * Uses concat demuxer approach for chunk concatenation.
   */
  buildAssembleArgs(
    plan: RenderPlan,
    chunks: readonly ChunkResult[],
    outputKey: string,
  ): string[] {
    const args: string[] = ["-y"];
    // Add each chunk as input
    for (const chunk of chunks) {
      const chunkPath = this.resolveS3Path(plan.input.bucket, chunk.artifactKey);
      args.push("-i", chunkPath);
    }

    // Build filter for concatenation
    const streams = chunks.map((_, i) => `[${i}:v][${i}:a]`).join("");
    const filterComplex = `${streams}concat=n=${chunks.length}:v=1:a=1[outv][outa]`;

    args.push("-filter_complex", filterComplex);
    args.push("-map", "[outv]", "-map", "[outa]");

    // Output encoding
    args.push(
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(plan.fps),
      "-b:v",
      `${plan.videoBitrateKbps}k`,
      "-c:a",
      "aac",
      "-b:a",
      "128k",
    );

    const outputPath = this.resolveS3Path(plan.input.bucket, outputKey);
    args.push(outputPath);

    return args;
  }
}
