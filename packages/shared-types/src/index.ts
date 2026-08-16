// Manifest schema and types
export {
  SourceKind,
  ScriptMode,
  LexiconMethod,
  StageStatus,
  AspectRatio,
  CaptionsOption,
  CostActualStatus,
  SourceSchema,
  VoiceSchema,
  OutputSchema,
  LexiconEntrySchema,
  ScriptSchema,
  PageSchema,
  StagesSchema,
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
  CostStageEntry,
  CostActual,
  Cost,
  Manifest,
} from "./manifest.js";

// Invariant validation
export {
  validateInvariants,
  TOLERANCES,
} from "./invariants.js";

export type { InvariantViolation } from "./invariants.js";

// S3 key builders
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
