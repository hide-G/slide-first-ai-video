export {
  buildBucketName,
  buildProjectPrefix,
  buildVersionPrefix,
  buildSlideImageKey,
  buildAudioKey,
  buildSpeechMarksKey,
  buildManifestKey,
  buildOutputKey,
  buildCaptionsKey,
} from "./s3-keys.js";

export {
  calculateDurationMs,
  calculateStartMs,
  calculateSlideDurations,
} from "./duration.js";

export { generateIdempotencyKey, isValidIdempotencyKey } from "./idempotency.js";

// Captions module
export {
  parseSpeechMarks,
  getWordMarks,
  buildCaptions,
  generateVtt,
  formatVttTimestamp,
  generateSrt,
  formatSrtTimestamp,
} from "./captions/index.js";
export type {
  SpeechMark,
  CaptionSegment,
  CaptionBuilderOptions,
} from "./captions/index.js";

// Audio module
export { calculatePcmDurationMs } from "./audio/index.js";
export type { PcmConfig } from "./audio/index.js";

// Manifest module
export {
  resolveTimings,
  validateTimings,
  buildManifest,
} from "./manifest/index.js";
export type {
  SlideTimingInput,
  ResolvedTiming,
  SlideInput,
  ManifestConfig,
} from "./manifest/index.js";

// Teaser module
export {
  calculateTeaserDuration,
  validateTeaserDuration,
  DEFAULT_TEASER_CONFIG,
  calculateSlideCardLayout,
  SLIDE_CARD_DIMENSIONS,
} from "./teaser/index.js";
