/**
 * DynamoDBのプロジェクトレコードから manifest.json を組み立てる。
 *
 * パイプラインの各工程は manifest.json だけを正本として読む。
 * APIはDynamoDBに保存しているため、レンダリング開始前にここで変換してS3へ書き出す。
 * この橋渡しが無いと、工程1が manifest.json を見つけられず失敗する。
 */

import { ManifestSchema, pageImageKey, audioKey } from "@slide-first/shared-types";
import type { Manifest, LexiconEntry, AspectRatio, CaptionsOption } from "@slide-first/shared-types";
import type { ProjectRecord } from "../db/projects.js";
import { ApiError } from "../middleware/index.js";

/**
 * Amazon Polly の PCM 出力で使えるサンプルレート。
 * mp3 は 8000/16000/22050/24000/44100/48000 だが、pcm は 8000 と 16000 のみ。
 * 以前 24000 を渡して "Invalid SampleRate parameter" で失敗した。
 */
const PCM_SAMPLE_RATES = ["8000", "16000"] as const;
const DEFAULT_SAMPLE_RATE = "16000";

const DEFAULT_VOICE = {
  id: "Takumi",
  engine: "neural",
  languageCode: "ja-JP",
  sampleRate: DEFAULT_SAMPLE_RATE,
} as const;

const ASPECT_SIZES: Record<AspectRatio, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

interface NarrationScript {
  pageNumber?: number;
  mode?: string;
  text?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** PCMで使えない値が入っていたら既定値へ寄せる */
function resolveSampleRate(value: unknown): string {
  const asString = typeof value === "string" ? value : String(value ?? "");
  return (PCM_SAMPLE_RATES as readonly string[]).includes(asString) ? asString : DEFAULT_SAMPLE_RATE;
}

export function buildManifestFromProject(project: ProjectRecord): Manifest {
  const { userId, projectId } = project;
  const keyParams = { userId, projectId };

  const source = asRecord(project.source);
  const sourceKind = source.kind === "generated" ? "generated" : "uploaded";
  const fileKey = typeof source.fileKey === "string" ? source.fileKey : "";
  const pageCount = Number(source.pageCount ?? 0);

  if (!fileKey || !Number.isInteger(pageCount) || pageCount < 1) {
    throw new ApiError(
      400,
      "Source must be registered with a page count before rendering",
      "SOURCE_REQUIRED",
    );
  }

  const scripts = Array.isArray(project.narration) ? (project.narration as NarrationScript[]) : [];
  if (scripts.length !== pageCount) {
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

  const outputInput = asRecord(project.output);
  const aspect = (
    ["16:9", "9:16", "1:1", "4:5"].includes(String(outputInput.aspect))
      ? outputInput.aspect
      : "16:9"
  ) as AspectRatio;
  const size = ASPECT_SIZES[aspect];
  const captions = (
    ["burn", "srt", "none"].includes(String(outputInput.captions)) ? outputInput.captions : "burn"
  ) as CaptionsOption;

  const output = {
    aspect,
    width: size.width,
    height: size.height,
    fps: Number(outputInput.fps) === 60 ? 60 : 30,
    captions,
    verticalLayout:
      typeof outputInput.verticalLayout === "string" ? outputInput.verticalLayout : null,
    padColor: typeof outputInput.padColor === "string" ? outputInput.padColor : null,
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

  // 音声の長さは工程2が実測して書き込む。ここでは0で置く
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

  const emptyScript = pages.find((p) => p.script.text.trim() === "");
  if (emptyScript) {
    throw new ApiError(
      400,
      `Page ${emptyScript.pageNumber} has an empty narration script`,
      "NARRATION_REQUIRED",
    );
  }

  const manifest = {
    schemaVersion: 1 as const,
    projectId,
    userId,
    contentLanguage: project.contentLanguage ?? "ja-JP",
    source: { kind: sourceKind as "generated" | "uploaded", fileKey, pageCount },
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
  };

  // 契約に合わない状態でパイプラインへ渡さない
  return ManifestSchema.parse(manifest) as Manifest;
}
