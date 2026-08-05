/**
 * Video composition builder Lambda handler.
 * Builds Hyperframes-compatible index.html from a VideoManifest.
 *
 * Generates an HTML composition with:
 * - Stage div with composition metadata (width, height, fps)
 * - Image clips with start/duration timing
 * - Audio elements with timing
 * - Caption overlay divs with synchronized text
 *
 * Uploads the generated HTML to S3.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { VideoManifest, OutputConfig } from "@slide-first/shared-types";
import { buildCompositionHtml } from "./html-builder.js";

/** Input event for the composition builder Lambda */
export interface CompositionBuilderEvent {
  manifest: VideoManifest;
  s3Bucket: string;
  s3Prefix: string;
  assetsPrefix: string;
  /** Which output config to use (key in manifest.outputs) */
  outputId: string;
}

/** Output from the composition builder Lambda */
export interface CompositionBuilderResult {
  compositionKey: string;
  assetsManifest: AssetsManifest;
}

/** Manifest of assets referenced by the composition */
export interface AssetsManifest {
  images: string[];
  audio: string[];
  totalSlides: number;
  totalDurationMs: number;
}

const s3Client = new S3Client({});

/**
 * Lambda handler for composition building.
 */
export const handler = async (
  event: CompositionBuilderEvent,
): Promise<CompositionBuilderResult> => {
  const { manifest, s3Bucket, s3Prefix, assetsPrefix, outputId } = event;

  // Look up the output configuration
  const output: OutputConfig | undefined = manifest.outputs[outputId];
  if (!output) {
    throw new Error(
      `Output configuration '${outputId}' not found in manifest. Available: ${Object.keys(manifest.outputs).join(", ")}`,
    );
  }

  // Generate the composition HTML
  const html = buildCompositionHtml({
    manifest,
    output,
    assetsPrefix,
  });

  // Upload to S3
  const compositionKey = `${s3Prefix}composition/${outputId}/index.html`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: compositionKey,
      Body: html,
      ContentType: "text/html; charset=utf-8",
    }),
  );

  // Build assets manifest
  const images = manifest.slides.map((s) => s.imageKey);
  const audio = manifest.slides.map((s) => s.voiceKey);
  const totalDurationMs = manifest.slides.reduce(
    (sum, s) => sum + s.durationMs,
    0,
  );

  const assetsManifestResult: AssetsManifest = {
    images,
    audio,
    totalSlides: manifest.slides.length,
    totalDurationMs,
  };

  return {
    compositionKey,
    assetsManifest: assetsManifestResult,
  };
};
