/**
 * Stage interfaces for the 5-stage video pipeline.
 *
 * Each stage:
 * 1. Reads manifest.json from S3
 * 2. Performs its work
 * 3. Updates manifest.stages[stageName] to 'done' (or 'failed')
 * 4. Writes updated manifest.json back to S3
 * 5. Can be re-run independently
 */

import type { Manifest } from "@slide-first/shared-types";

/** S3 client interface for dependency injection */
export interface S3Port {
  getObject(bucket: string, key: string): Promise<Buffer>;
  putObject(bucket: string, key: string, body: Buffer | Uint8Array | string, contentType?: string): Promise<void>;
}

/** Common context passed to every stage handler */
export interface StageContext {
  bucket: string;
  manifestKey: string;
  s3: S3Port;
}

/** Result of a stage execution */
export interface StageResult {
  success: boolean;
  manifest: Manifest;
  error?: string;
}

/**
 * Stage 1: Pages
 * Converts PDF/PPTX source into individual PNG page images.
 * Input: input/source.pdf or deck/deck.pdf
 * Output: pages/page-001.png, pages/page-002.png, etc.
 */
export interface PagesStage {
  execute(ctx: StageContext): Promise<StageResult>;
}

/**
 * Stage 2: Audio
 * Synthesizes speech audio for each page using Amazon Polly.
 * Input: confirmed script.text + voice config + lexicon
 * Output: audio/page-001.mp3, audio/page-002.mp3, etc. + measured audioDurationSec
 */
export interface AudioStage {
  execute(ctx: StageContext): Promise<StageResult>;
}

/**
 * Stage 3: Captions
 * Generates SRT captions from scripts and measured audio durations.
 * Input: confirmed scripts + audioDurationSec (must all be measured)
 * Output: captions/captions.srt
 */
export interface CaptionsStage {
  execute(ctx: StageContext): Promise<StageResult>;
}

/**
 * Stage 4: Clips
 * Creates per-page video clips by combining PNG + MP3 with FFmpeg.
 * Input: pages/page-NNN.png + audio/page-NNN.mp3 + audioDurationSec
 * Output: clips/page-NNN.mp4
 */
export interface ClipsStage {
  execute(ctx: StageContext): Promise<StageResult>;
}

/**
 * Stage 5: Concat
 * Concatenates all clips into the final video, optionally burning subtitles.
 * Input: clips/page-NNN.mp4 + optionally captions/captions.srt
 * Output: output/{renderId}/video.mp4
 */
export interface ConcatStage {
  execute(ctx: StageContext): Promise<StageResult>;
}

export type { Manifest } from "@slide-first/shared-types";
