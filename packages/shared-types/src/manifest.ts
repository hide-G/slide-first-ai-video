import { z } from "zod";

// --- Enums / Literals ---

export const SourceKind = z.enum(["generated", "uploaded"]);
export type SourceKind = z.infer<typeof SourceKind>;

export const ScriptMode = z.enum(["plain", "ssml"]);
export type ScriptMode = z.infer<typeof ScriptMode>;

export const LexiconMethod = z.enum(["sub", "phoneme", "spell"]);
export type LexiconMethod = z.infer<typeof LexiconMethod>;

export const StageStatus = z.enum(["pending", "running", "done", "failed"]);
export type StageStatus = z.infer<typeof StageStatus>;

export const AspectRatio = z.enum(["16:9", "9:16", "1:1", "4:5"]);
export type AspectRatio = z.infer<typeof AspectRatio>;

export const CaptionsOption = z.enum(["burn", "srt", "none"]);
export type CaptionsOption = z.infer<typeof CaptionsOption>;

export const CostActualStatus = z.enum(["pending", "reconciled"]);
export type CostActualStatus = z.infer<typeof CostActualStatus>;

// --- Sub-schemas ---

export const SourceSchema = z.object({
  kind: SourceKind,
  fileKey: z.string().min(1),
  pageCount: z.number().int().positive(),
});
export type Source = z.infer<typeof SourceSchema>;

export const VoiceSchema = z.object({
  id: z.string().min(1),
  engine: z.string().min(1),
  languageCode: z.string().min(1),
  sampleRate: z.string().min(1),
});
export type Voice = z.infer<typeof VoiceSchema>;

export const OutputSchema = z.object({
  aspect: AspectRatio,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
  captions: CaptionsOption,
  verticalLayout: z.string().nullable(),
  padColor: z.string().nullable(),
});
export type Output = z.infer<typeof OutputSchema>;

export const LexiconEntrySchema = z.object({
  written: z.string().min(1),
  reading: z.string().min(1),
  method: LexiconMethod,
});
export type LexiconEntry = z.infer<typeof LexiconEntrySchema>;

export const ScriptSchema = z.object({
  mode: ScriptMode,
  text: z.string(),
});
export type Script = z.infer<typeof ScriptSchema>;

export const PageSchema = z.object({
  pageNumber: z.number().int().positive(),
  imageKey: z.string().min(1),
  script: ScriptSchema,
  audioKey: z.string().min(1),
  audioDurationSec: z.number().nonnegative(),
  frameAlignedDurationMs: z.number().nonnegative(),
});
export type Page = z.infer<typeof PageSchema>;

export const StagesSchema = z.object({
  pages: StageStatus,
  audio: StageStatus,
  captions: StageStatus,
  video: StageStatus,
});
export type Stages = z.infer<typeof StagesSchema>;

// --- Cost sub-schemas ---

export const CostStageEntrySchema = z.object({
  stage: z.string().min(1),
  service: z.string().min(1),
  usage: z.record(z.unknown()),
  estimatedCost: z.number().nonnegative(),
});
export type CostStageEntry = z.infer<typeof CostStageEntrySchema>;

export const CostActualSchema = z.object({
  status: CostActualStatus,
  amount: z.number().nonnegative().nullable(),
  reconciledAt: z.string().nullable(),
});
export type CostActual = z.infer<typeof CostActualSchema>;

export const CostSchema = z.object({
  currency: z.string().min(1),
  priceListFetchedAt: z.string().min(1),
  stages: z.array(CostStageEntrySchema),
  estimatedTotal: z.number().nonnegative(),
  actual: CostActualSchema,
});
export type Cost = z.infer<typeof CostSchema>;

// --- Main Manifest schema ---

export const ManifestSchema = z.object({
  schemaVersion: z.literal(1),
  projectId: z.string().min(1),
  userId: z.string().min(1),
  contentLanguage: z.string().min(1),
  source: SourceSchema,
  voice: VoiceSchema,
  output: OutputSchema,
  lexicon: z.array(LexiconEntrySchema),
  pages: z.array(PageSchema),
  stages: StagesSchema,
  cost: CostSchema.optional(),
});
export type Manifest = z.infer<typeof ManifestSchema>;
