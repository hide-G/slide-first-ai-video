/**
 * S3 key builder functions following the design document structure:
 *
 * Bucket: {productSlug}-{purpose}-{env}-{accountId}-{region}
 *
 * Key structure:
 *   {userId}/{projectId}/versions/v{NNNN}/...
 *     slides/deck.001.png
 *     audio/slide-001.pcm
 *     audio/slide-001-marks.json
 *     captions/captions.json
 *     captions/full.ja.vtt
 *     captions/full.ja.srt
 *     video/video-manifest.json
 *     output/lt-full-16x9.mp4
 */

export interface BucketNameParams {
  productSlug: string;
  purpose: string;
  env: string;
  accountId: string;
  region: string;
}

export interface KeyPrefixParams {
  userId: string;
  projectId: string;
  versionNumber: number;
}

/**
 * Build the S3 bucket name following the convention:
 * {productSlug}-{purpose}-{env}-{accountId}-{region}
 */
export function buildBucketName(params: BucketNameParams): string {
  const { productSlug, purpose, env, accountId, region } = params;
  return `${productSlug}-${purpose}-${env}-${accountId}-${region}`;
}

/**
 * Build the project prefix:
 * {userId}/{projectId}/
 */
export function buildProjectPrefix(params: Pick<KeyPrefixParams, "userId" | "projectId">): string {
  return `${params.userId}/${params.projectId}/`;
}

/**
 * Build the version prefix:
 * {userId}/{projectId}/versions/v{NNNN}/
 */
export function buildVersionPrefix(params: KeyPrefixParams): string {
  const versionPadded = String(params.versionNumber).padStart(4, "0");
  return `${params.userId}/${params.projectId}/versions/v${versionPadded}/`;
}

/**
 * Build S3 key for a slide image.
 * Example: {userId}/{projectId}/versions/v0001/slides/deck.001.png
 */
export function buildSlideImageKey(
  params: KeyPrefixParams,
  slideNumber: number,
): string {
  const prefix = buildVersionPrefix(params);
  const paddedSlide = String(slideNumber).padStart(3, "0");
  return `${prefix}slides/deck.${paddedSlide}.png`;
}

/**
 * Build S3 key for slide audio (PCM).
 * Example: {userId}/{projectId}/versions/v0001/audio/slide-001.pcm
 */
export function buildAudioKey(
  params: KeyPrefixParams,
  slideNumber: number,
): string {
  const prefix = buildVersionPrefix(params);
  const paddedSlide = String(slideNumber).padStart(3, "0");
  return `${prefix}audio/slide-${paddedSlide}.pcm`;
}

/**
 * Build S3 key for speech marks JSON.
 * Example: {userId}/{projectId}/versions/v0001/audio/slide-001-marks.json
 */
export function buildSpeechMarksKey(
  params: KeyPrefixParams,
  slideNumber: number,
): string {
  const prefix = buildVersionPrefix(params);
  const paddedSlide = String(slideNumber).padStart(3, "0");
  return `${prefix}audio/slide-${paddedSlide}-marks.json`;
}

/**
 * Build S3 key for the video manifest.
 * Example: {userId}/{projectId}/versions/v0001/video/video-manifest.json
 */
export function buildManifestKey(params: KeyPrefixParams): string {
  const prefix = buildVersionPrefix(params);
  return `${prefix}video/video-manifest.json`;
}

/**
 * Build S3 key for final video output.
 * Example: {userId}/{projectId}/versions/v0001/output/lt-full-16x9.mp4
 */
export function buildOutputKey(
  params: KeyPrefixParams,
  outputName: string,
): string {
  const prefix = buildVersionPrefix(params);
  return `${prefix}output/${outputName}.mp4`;
}

/**
 * Build S3 key for captions file.
 * Example: {userId}/{projectId}/versions/v0001/captions/full.ja.vtt
 */
export function buildCaptionsKey(
  params: KeyPrefixParams,
  filename: string,
): string {
  const prefix = buildVersionPrefix(params);
  return `${prefix}captions/${filename}`;
}
