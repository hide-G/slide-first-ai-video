/**
 * DynamoDBのプロジェクトレコードから manifest.json を組み立てる。
 *
 * パイプラインの各工程は manifest.json だけを正本として読む。
 * APIはDynamoDBに保存しているため、レンダリング開始前にここで変換してS3へ書き出す。
 */

import {
  ManifestSchema,
  pageImageKey,
  audioKey,
  getOutputProfile,
} from "@slide-first/shared-types";
import type {
  Manifest,
  LexiconEntry,
  AspectRatio,
  CaptionsOption,
  VerticalLayout,
  PadColor,
} from "@slide-first/shared-types";
import type { ProjectRecord } from "../db/projects.js";
import { ApiError } from "../middleware/index.js";

/** Amazon PollyのPCM出力で使えるサンプルレート。 */
const PCM_SAMPLE_RATES = ["8000", "16000"] as const;
const DEFAULT_SAMPLE_RATE = "16000";
const DEFAULT_SILENT_PAGE_DURATION_SEC = 5;
const MIN_SILENT_PAGE_DURATION_SEC = 1;
const MAX_SILENT_PAGE_DURATION_SEC = 30;

const DEFAULT_VOICE = {
  id: "Takumi",
  engine: "neural",
  languageCode: "ja-JP",
  sampleRate: DEFAULT_SAMPLE_RATE,
} as const;

interface NarrationScript {
  pageNumber?: number;
  mode?: string;
  text?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** PCMで使えない値が入っていたら既定値へ寄せる。 */
function resolveSampleRate(value: unknown): string {
  const asString = typeof value === "string" ? value : String(value ?? "");
  return (PCM_SAMPLE_RATES as readonly string[]).includes(asString)
    ? asString
    : DEFAULT_SAMPLE_RATE;
}

function resolveAspect(value: unknown): AspectRatio {
  return (["16:9", "9:16", "1:1", "4:5"] as const).includes(value as AspectRatio)
    ? (value as AspectRatio)
    : "16:9";
}

function resolveCaptions(value: unknown): CaptionsOption {
  return (["burn", "srt", "none"] as const).includes(value as CaptionsOption)
    ? (value as CaptionsOption)
    : "burn";
}

function resolveNarrationMode(value: unknown): "spoken" | "none" {
  return value === "none" ? "none" : "spoken";
}

/** 保存済み設定が古い場合も、有効な無音表示時間へ正規化する。 */
function resolveSilentPageDurationSec(value: unknown): number {
  const duration = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(duration)) {
    return DEFAULT_SILENT_PAGE_DURATION_SEC;
  }

  return Math.min(
    MAX_SILENT_PAGE_DURATION_SEC,
    Math.max(MIN_SILENT_PAGE_DURATION_SEC, Math.round(duration)),
  );
}

function resolveVerticalLayout(value: unknown): VerticalLayout | null {
  return (["top", "center", "crop"] as const).includes(value as VerticalLayout)
    ? (value as VerticalLayout)
    : null;
}

function resolvePadColor(value: unknown): PadColor | null {
  return (["white", "navy", "auto"] as const).includes(value as PadColor)
    ? (value as PadColor)
    : null;
}

export function buildManifestFromProject(project: ProjectRecord): Manifest {
  const { userId, projectId } = project;
  const keyParams = { userId, projectId };

  const source = asRecord(project.source);
  const sourceKind = source.kind === "generated" ? "generated" : "uploaded";
  const fileKey = typeof source.fileKey === "string" ? source.fileKey : "";
  const fileName = typeof source.fileName === "string" ? source.fileName : undefined;
  const pageCount = Number(source.pageCount ?? 0);

  if (!fileKey || !Number.isInteger(pageCount) || pageCount < 1) {
    throw new ApiError(
      400,
      "Source must be registered with a page count before rendering",
      "SOURCE_REQUIRED",
    );
  }

  const scripts = Array.isArray(project.narration) ? (project.narration as NarrationScript[]) : [];
  const outputInput = asRecord(project.output);
  const narrationMode = resolveNarrationMode(outputInput.narrationMode);
  const silentPageDurationSec = resolveSilentPageDurationSec(outputInput.silentPageDurationSec);

  if (narrationMode === "spoken" && scripts.length !== pageCount) {
    throw new ApiError(
      400,
      `Narration must be saved for all ${pageCount} pages before rendering (got ${scripts.length})`,
      "NARRATION_REQUIRED",
    );
  }

  const voiceInput = asRecord(project.voice);
  const voice = {
    id: typeof voiceInput.id === "string" ? voiceInput.id : DEFAULT_VOICE.id,
    engine: typeof voiceInput.engine === "string" ? voiceInput.engine : DEFAULT_VOICE.engine,
    languageCode:
      typeof voiceInput.languageCode === "string"
        ? voiceInput.languageCode
        : DEFAULT_VOICE.languageCode,
    sampleRate: resolveSampleRate(voiceInput.sampleRate),
  };

  const aspect = resolveAspect(outputInput.aspect);
  const profile = getOutputProfile(aspect);
  const output = {
    aspect,
    width: profile.width,
    height: profile.height,
    fps: Number(outputInput.fps) === 60 ? 60 : 30,
    captions: narrationMode === "none" ? ("none" as const) : resolveCaptions(outputInput.captions),
    narrationMode,
    silentPageDurationSec,
    verticalLayout: resolveVerticalLayout(outputInput.verticalLayout),
    padColor: resolvePadColor(outputInput.padColor),
  };

  const lexicon = (Array.isArray(project.lexicon) ? project.lexicon : []).filter(
    (entry): entry is LexiconEntry => {
      const e = asRecord(entry);
      return (
        typeof e.written === "string" &&
        typeof e.reading === "string" &&
        ["sub", "phoneme", "spell"].includes(String(e.method))
      );
    },
  );

  const pages = Array.from({ length: pageCount }, (_, index) => {
    const pageNumber = index + 1;
    const script = scripts[index] ?? {};
    return {
      pageNumber,
      imageKey: pageImageKey(keyParams, pageNumber),
      script: {
        mode: script.mode === "ssml" ? ("ssml" as const) : ("plain" as const),
        text: typeof script.text === "string" ? script.text : "",
      },
      audioKey: audioKey(keyParams, pageNumber),
      audioDurationSec: 0,
      frameAlignedDurationMs: 0,
    };
  });

  if (narrationMode === "spoken") {
    const emptyScript = pages.find((page) => page.script.text.trim() === "");
    if (emptyScript) {
      throw new ApiError(
        400,
        `Page ${emptyScript.pageNumber} has an empty narration script`,
        "NARRATION_REQUIRED",
      );
    }
  }

  const manifest = {
    schemaVersion: 1 as const,
    projectId,
    userId,
    contentLanguage: project.contentLanguage ?? "ja-JP",
    source: {
      kind: sourceKind as "generated" | "uploaded",
      fileKey,
      pageCount,
      ...(fileName ? { fileName } : {}),
    },
    voice,
    output,
    lexicon,
    pages,
    stages: {
      pages: "pending" as const,
      audio: "pending" as const,
      captions: "pending" as const,
      video: "pending" as const,
    },
    progress: {
      stage: "pages" as const,
      currentPage: 0,
      totalPages: pageCount,
      message: "PDFページを画像に変換する準備をしています。",
      updatedAt: new Date().toISOString(),
    },
  };

  return ManifestSchema.parse(manifest) as Manifest;
}
