// マニフェストスキーマと型
export {
  SourceKind,
  ScriptMode,
  LexiconMethod,
  StageStatus,
  RenderStageName,
  AspectRatio,
  CaptionsOption,
  NarrationMode,
  VerticalLayout,
  PadColor,
  SUPPORTED_FPS,
  OUTPUT_PROFILES,
  getOutputProfile,
  CostActualStatus,
  SourceSchema,
  VoiceSchema,
  OutputSchema,
  LexiconEntrySchema,
  ScriptSchema,
  PageSchema,
  StagesSchema,
  RenderProgressSchema,
  CostStageEntrySchema,
  CostActualSchema,
  CostSchema,
  ManifestSchema,
} from "./manifest.js";

export type {
  Source,
  Voice,
  Output,
  LexiconEntry,
  Script,
  Page,
  Stages,
  RenderProgress,
  CostStageEntry,
  CostActual,
  Cost,
  Manifest,
  VerticalLayout as VerticalLayoutValue,
  PadColor as PadColorValue,
  SupportedFps,
} from "./manifest.js";

// 不変条件の検証
export { validateInvariants, getFrameExcessLimitMs, TOLERANCES } from "./invariants.js";

export type { InvariantViolation } from "./invariants.js";

// S3キービルダー
export {
  inputSourceKey,
  deckKey,
  pageImageKey,
  audioKey,
  captionsSrtKey,
  outputVideoKey,
  manifestKey,
  projectPrefix,
} from "./s3-keys.js";

export type { S3KeyParams } from "./s3-keys.js";
