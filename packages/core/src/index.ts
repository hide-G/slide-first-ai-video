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
