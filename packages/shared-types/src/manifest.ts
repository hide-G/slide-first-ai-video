import { z } from "zod";

// --- 列挙値 / リテラル ---

export const SourceKind = z.enum(["generated", "uploaded"]);
export type SourceKind = z.infer<typeof SourceKind>;

export const ScriptMode = z.enum(["plain", "ssml"]);
export type ScriptMode = z.infer<typeof ScriptMode>;

export const LexiconMethod = z.enum(["sub", "phoneme", "spell"]);
export type LexiconMethod = z.infer<typeof LexiconMethod>;

export const StageStatus = z.enum(["pending", "running", "done", "failed"]);
export type StageStatus = z.infer<typeof StageStatus>;

/** レンダリング工程を表す安定した識別子。 */
export const RenderStageName = z.enum(["pages", "audio", "captions", "video"]);
export type RenderStageName = z.infer<typeof RenderStageName>;

export const AspectRatio = z.enum(["16:9", "9:16", "1:1", "4:5"]);
export type AspectRatio = z.infer<typeof AspectRatio>;

export const CaptionsOption = z.enum(["burn", "srt", "none"]);
export type CaptionsOption = z.infer<typeof CaptionsOption>;

/** 音声原稿を読み上げるか、無音動画を作るかを表す。 */
export const NarrationMode = z.enum(["spoken", "none"]);
export type NarrationMode = z.infer<typeof NarrationMode>;

export const VerticalLayout = z.enum(["top", "center", "crop"]);
export type VerticalLayout = z.infer<typeof VerticalLayout>;

export const PadColor = z.enum(["white", "navy", "auto"]);
export type PadColor = z.infer<typeof PadColor>;

export const SUPPORTED_FPS = [30, 60] as const;
export type SupportedFps = (typeof SUPPORTED_FPS)[number];

export const OUTPUT_PROFILES = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
} as const satisfies Record<AspectRatio, { width: number; height: number }>;

export function getOutputProfile(aspect: AspectRatio) {
  return OUTPUT_PROFILES[aspect];
}

export const CostActualStatus = z.enum(["pending", "reconciled"]);
export type CostActualStatus = z.infer<typeof CostActualStatus>;

// --- サブスキーマ ---

export const SourceSchema = z.object({
  kind: SourceKind,
  fileKey: z.string().min(1),
  pageCount: z.number().int().positive(),
  /** アップロード時の表示用ファイル名。S3キーには使用しない。 */
  fileName: z.string().min(1).max(255).optional(),
});
export type Source = z.infer<typeof SourceSchema>;

export const VoiceSchema = z.object({
  id: z.string().min(1),
  engine: z.string().min(1),
  languageCode: z.string().min(1),
  sampleRate: z.string().min(1),
});
export type Voice = z.infer<typeof VoiceSchema>;

export const OutputSchema = z
  .object({
    aspect: AspectRatio,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().int(),
    captions: CaptionsOption,
    narrationMode: NarrationMode.optional(),
    silentPageDurationSec: z.number().int().min(1).max(30).optional(),
    verticalLayout: VerticalLayout.nullable().optional(),
    padColor: PadColor.nullable().optional(),
  })
  .superRefine((output, context) => {
    if (output.narrationMode === "none" && output.captions !== "none") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["captions"],
        message: "ナレーションなし動画では字幕を none にする必要があります",
      });
    }

    const profile = getOutputProfile(output.aspect);

    if (output.width !== profile.width) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["width"],
        message: `${output.aspect} の幅は ${profile.width} である必要があります`,
      });
    }

    if (output.height !== profile.height) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["height"],
        message: `${output.aspect} の高さは ${profile.height} である必要があります`,
      });
    }

    if (!(SUPPORTED_FPS as readonly number[]).includes(output.fps)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fps"],
        message: "fps は 30 または 60 である必要があります",
      });
    }

    if (output.width % 2 !== 0 || output.height % 2 !== 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["width"],
        message: "映像の幅と高さは偶数である必要があります",
      });
    }
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

/** ブラウザへ返すページ単位の進捗情報。 */
export const RenderProgressSchema = z.object({
  stage: RenderStageName,
  currentPage: z.number().int().nonnegative(),
  totalPages: z.number().int().positive(),
  message: z.string().min(1).max(240),
  updatedAt: z.string().datetime(),
});
export type RenderProgress = z.infer<typeof RenderProgressSchema>;

// --- コストサブスキーマ ---

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

// --- メインマニフェストスキーマ ---

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
  /** 旧マニフェストとの互換性のため任意項目として扱う。 */
  progress: RenderProgressSchema.optional(),
  cost: CostSchema.optional(),
});
export type Manifest = z.infer<typeof ManifestSchema>;
