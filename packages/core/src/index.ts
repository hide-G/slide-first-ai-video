// S3 key builders (re-exports from shared-types + convenience helpers)
export {
  inputSourceKey,
  deckKey,
  pageImageKey,
  audioKey,
  captionsSrtKey,
  outputVideoKey,
  manifestKey,
  projectPrefix,
  pageKeys,
  renderKeys,
  buildVersionPrefix,
} from "./s3-keys.js";
export type { S3KeyParams } from "./s3-keys.js";

// Duration calculations
export {
  totalDurationSec,
  calculatePageTimings,
  calculateFrameAlignedTimings,
  totalFrameAlignedDurationMs,
  pageStartSec,
} from "./duration.js";
export type { PageTiming, FrameAlignedTiming } from "./duration.js";

// Idempotency
export { generateIdempotencyKey, isValidIdempotencyKey } from "./idempotency.js";

// Captions (SRT generation)
export { generateSrt, formatSrtTimestamp } from "./captions/index.js";

// Script hash (cost control)
export { computeScriptHash, hasScriptChanged } from "./script-hash.js";

// Frame alignment (MediaConvert timing)
export { alignToFrame, alignToFrameFromSec } from "./frame-alignment.js";

// WAV / PCM utilities
export { calculatePcmDurationSec, createWavHeader } from "./wav.js";
