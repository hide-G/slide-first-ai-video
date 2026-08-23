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
  CaptionStylePreset,
  CaptionPlacement,
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

function supportsCaptionSafeArea(
  aspect: AspectRatio,
  verticalLayout: VerticalLayout | null,
): boolean {
  return (aspect === "9:16" || aspect === "4:5") && verticalLayout === "top";
}

/** 保存済み設定が不成立なら従来どおり映像下端へ正規化する。 */
function resolveCaptionPlacement(
  value: unknown,
  aspect: AspectRatio,
  verticalLayout: VerticalLayout | null,
): CaptionPlacement {
  return value === "safe-area" && supportsCaptionSafeArea(aspect, verticalLayout)
    ? "safe-area"
    : "bottom";
}

/** 黒板風は下部セーフエリアを実際に確保できる場合だけ有効にする。 */
function resolveCaptionStyle(
  value: unknown,
  captionPlacement: CaptionPlacement,
  aspect: AspectRatio,
  verticalLayout: VerticalLayout | null,
): CaptionStylePreset {
  const style = (
    ["white-outline", "yellow-outline", "black-background", "chalkboard"] as const
  ).includes(value as CaptionStylePreset)
    ? (value as CaptionStylePreset)
    : "white-outline";

  return style === "chalkboard" &&
    (captionPlacement !== "safe-area" || !supportsCaptionSafeArea(aspect, verticalLayout))
    ? "white-outline"
    : style;
}

export type PartialRenderStartStage = "audio" | "captions" | "video";

/** 既存のページ成果物を再利用して部分再実行するときだけ渡す実行時状態。 */
export interface PartialRenderManifestInput {
  startStage: PartialRenderStartStage;
  previousManifest: Manifest;
}

/**
 * DynamoDBの保存状態から新しい実行用manifestを組み立てる。
 * 部分再実行では、互換性を確認済みの既存manifestから必要な実行時状態だけを引き継ぐ。
 */
export function buildManifestFromProject(
  project: ProjectRecord,
  partialRender?: PartialRenderManifestInput,
): Manifest {
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
  const verticalLayout = resolveVerticalLayout(outputInput.verticalLayout);
  const captions =
    narrationMode === "none" ? ("none" as const) : resolveCaptions(outputInput.captions);
  const usesBurnInCaptions = captions === "burn";
  const captionPlacement = usesBurnInCaptions
    ? resolveCaptionPlacement(outputInput.captionPlacement, aspect, verticalLayout)
    : null;
  const output = {
    aspect,
    width: profile.width,
    height: profile.height,
    fps: Number(outputInput.fps) === 60 ? 60 : 30,
    captions,
    narrationMode,
    silentPageDurationSec,
    verticalLayout,
    padColor: resolvePadColor(outputInput.padColor),
    captionStyle:
      usesBurnInCaptions && captionPlacement !== null
        ? resolveCaptionStyle(outputInput.captionStyle, captionPlacement, aspect, verticalLayout)
        : null,
    captionPlacement,
    // 描画後にだけ決まる値のため、通常開始では必ずnullから始める。
    captionSafeAreaYPosition: null,
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

  const freshManifest = ManifestSchema.parse({
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
  }) as Manifest;

  return partialRender
    ? mergePartialRenderRuntimeState(
        freshManifest,
        partialRender.previousManifest,
        partialRender.startStage,
      )
    : freshManifest;
}

/**
 * 字幕スタイル追加前のmanifestは、captionStyle と captionPlacement を持たない。
 * 比較時だけ現在と同じ既定値へ寄せ、旧manifest自体や実行時状態は変更しない。
 */
function resolvePreviousCaptionPresentation(previous: Manifest): {
  captionStyle: CaptionStylePreset | null;
  captionPlacement: CaptionPlacement | null;
} {
  if (previous.output.captions !== "burn") {
    return { captionStyle: null, captionPlacement: null };
  }

  const verticalLayout = previous.output.verticalLayout ?? null;
  const captionPlacement = resolveCaptionPlacement(
    previous.output.captionPlacement,
    previous.output.aspect,
    verticalLayout,
  );

  return {
    captionStyle: resolveCaptionStyle(
      previous.output.captionStyle,
      captionPlacement,
      previous.output.aspect,
      verticalLayout,
    ),
    captionPlacement,
  };
}

/**
 * 安全に再利用できるのは、現在の出力設定で生成したページ画像だけである。
 * safe-area座標はPNGの実際の下端に依存するため、描画に影響する設定が変われば再利用しない。
 */
function hasCompatiblePageRenderInputs(fresh: Manifest, previous: Manifest): boolean {
  const previousCaptionPresentation = resolvePreviousCaptionPresentation(previous);

  return (
    fresh.source.kind === previous.source.kind &&
    fresh.source.fileKey === previous.source.fileKey &&
    fresh.source.pageCount === previous.source.pageCount &&
    fresh.output.aspect === previous.output.aspect &&
    fresh.output.width === previous.output.width &&
    fresh.output.height === previous.output.height &&
    fresh.output.fps === previous.output.fps &&
    fresh.output.captions === previous.output.captions &&
    fresh.output.narrationMode === previous.output.narrationMode &&
    fresh.output.silentPageDurationSec === previous.output.silentPageDurationSec &&
    fresh.output.verticalLayout === previous.output.verticalLayout &&
    fresh.output.padColor === previous.output.padColor &&
    fresh.output.captionStyle === previousCaptionPresentation.captionStyle &&
    fresh.output.captionPlacement === previousCaptionPresentation.captionPlacement &&
    fresh.pages.length === previous.pages.length &&
    fresh.pages.every(
      (page, index) =>
        page.pageNumber === previous.pages[index]?.pageNumber &&
        page.imageKey === previous.pages[index]?.imageKey &&
        page.audioKey === previous.pages[index]?.audioKey,
    )
  );
}

/** 音声を再利用する場合は、音声に影響する原稿・音声・辞書も同一でなければならない。 */
function hasCompatibleNarrationInputs(fresh: Manifest, previous: Manifest): boolean {
  return (
    hasCompatiblePageRenderInputs(fresh, previous) &&
    fresh.contentLanguage === previous.contentLanguage &&
    fresh.voice.id === previous.voice.id &&
    fresh.voice.engine === previous.voice.engine &&
    fresh.voice.languageCode === previous.voice.languageCode &&
    fresh.voice.sampleRate === previous.voice.sampleRate &&
    fresh.lexicon.length === previous.lexicon.length &&
    fresh.lexicon.every(
      (entry, index) =>
        entry.written === previous.lexicon[index]?.written &&
        entry.reading === previous.lexicon[index]?.reading &&
        entry.method === previous.lexicon[index]?.method,
    ) &&
    fresh.pages.every(
      (page, index) =>
        page.script.mode === previous.pages[index]?.script.mode &&
        page.script.text === previous.pages[index]?.script.text,
    )
  );
}

function hasMeasuredAudio(previous: Manifest): boolean {
  return previous.pages.every(
    (page) =>
      page.audioDurationSec > 0 &&
      page.frameAlignedDurationMs > 0 &&
      page.frameAlignedDurationMs >= page.audioDurationSec * 1000,
  );
}

function throwPartialRenderRequiresPages(): never {
  throw new ApiError(
    409,
    "部分再実行に必要な既存のページ・音声・字幕状態を確認できません。pagesから再実行してください。",
    "PARTIAL_RENDER_REQUIRES_PAGES",
  );
}

/**
 * 新しいDynamoDB設定を正本にしつつ、互換な既存manifestの実行時状態だけを引き継ぐ。
 * 既存manifest全体を使い回さないため、過去の進捗・費用・失敗状態は新しいレンダーへ持ち込まない。
 */
function mergePartialRenderRuntimeState(
  fresh: Manifest,
  previous: Manifest,
  startStage: PartialRenderStartStage,
): Manifest {
  if (previous.stages.pages !== "done" || !hasCompatiblePageRenderInputs(fresh, previous)) {
    return throwPartialRenderRequiresPages();
  }

  if (
    (startStage === "captions" || startStage === "video") &&
    (previous.stages.audio !== "done" ||
      !hasMeasuredAudio(previous) ||
      !hasCompatibleNarrationInputs(fresh, previous))
  ) {
    return throwPartialRenderRequiresPages();
  }

  if (startStage === "video" && previous.stages.captions !== "done") {
    return throwPartialRenderRequiresPages();
  }

  const pages =
    startStage === "audio"
      ? fresh.pages
      : fresh.pages.map((page, index) => ({
          ...page,
          audioDurationSec: previous.pages[index].audioDurationSec,
          frameAlignedDurationMs: previous.pages[index].frameAlignedDurationMs,
        }));

  const stages =
    startStage === "audio"
      ? {
          pages: "done" as const,
          audio: "pending" as const,
          captions: "pending" as const,
          video: "pending" as const,
        }
      : startStage === "captions"
        ? {
            pages: "done" as const,
            audio: "done" as const,
            captions: "pending" as const,
            video: "pending" as const,
          }
        : {
            pages: "done" as const,
            audio: "done" as const,
            captions: "done" as const,
            video: "pending" as const,
          };

  return ManifestSchema.parse({
    ...fresh,
    output: {
      ...fresh.output,
      captionSafeAreaYPosition: previous.output.captionSafeAreaYPosition ?? null,
    },
    pages,
    stages,
  }) as Manifest;
}
