/**
 * レンダリング API ハンドラー:
 *   POST /projects/{id}/renders - レンダリングパイプラインを開始する
 *   GET  /projects/{id}/renders/{renderId} - Step Functions と同期した状態を取得する
 *   GET  /projects/{id}/renders/{renderId}/artifacts - 成果物の署名付き URL を取得する
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  SFNClient,
  StartExecutionCommand,
  DescribeExecutionCommand,
  GetExecutionHistoryCommand,
} from "@aws-sdk/client-sfn";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ulid } from "ulid";
import { ManifestSchema, manifestKey } from "@slide-first/shared-types";
import type { RenderProgress } from "@slide-first/shared-types";
import {
  requireAuth,
  verifyProjectOwnership,
  validateBody,
  StartRenderSchema,
  buildResponse,
  ApiError,
  NotFoundError,
} from "../middleware/index.js";
import { createRender, getRender, updateRenderStatus, updateProject } from "../db/index.js";
import type { RenderRecord } from "../db/index.js";
import { buildManifestFromProject } from "../manifest/build-manifest.js";

const sfnClient = new SFNClient({});
const s3Client = new S3Client({});
const RENDER_STATE_MACHINE_ARN = process.env.RENDER_STATE_MACHINE_ARN ?? "";
const BUCKET_NAME = process.env.BUCKET_NAME ?? "";
const RENDER_FAILED_ERROR = "RENDER_FAILED";

const stageByStateName: Record<string, RenderProgress["stage"]> = {
  PagesStage: "pages",
  AudioStage: "audio",
  CaptionsStage: "captions",
  VideoStage: "video",
};

const stageMessage: Record<RenderProgress["stage"], string> = {
  pages: "PDFページを画像に変換しています。",
  audio: "ページごとのナレーション音声を生成しています。",
  captions: "字幕を生成しています。",
  video: "動画をエンコードしています。",
};

function isRenderStage(value: string | undefined): value is RenderProgress["stage"] {
  return value === "pages" || value === "audio" || value === "captions" || value === "video";
}

function createInitialProgress(
  stage: RenderProgress["stage"],
  totalPages: number,
  updatedAt: string,
): RenderProgress {
  return {
    stage,
    currentPage: 0,
    totalPages,
    message: stageMessage[stage],
    updatedAt,
  };
}

function progressFromRender(render: RenderRecord): RenderProgress | undefined {
  if (
    !isRenderStage(render.currentStage) ||
    typeof render.currentPage !== "number" ||
    typeof render.totalPages !== "number" ||
    render.totalPages < 1 ||
    typeof render.progressMessage !== "string" ||
    !render.progressMessage ||
    typeof render.progressUpdatedAt !== "string" ||
    !render.progressUpdatedAt
  ) {
    return undefined;
  }

  return {
    stage: render.currentStage,
    currentPage: render.currentPage,
    totalPages: render.totalPages,
    message: render.progressMessage,
    updatedAt: render.progressUpdatedAt,
  };
}

function renderSummary(render: RenderRecord) {
  return {
    renderId: render.renderId,
    status: render.status,
    startedAt: render.startedAt,
    updatedAt: render.updatedAt,
    currentStage: render.currentStage,
    currentPage: render.currentPage,
    totalPages: render.totalPages,
    progressMessage: render.progressMessage,
    progressUpdatedAt: render.progressUpdatedAt,
    completedAt: render.completedAt,
    error: render.error,
  };
}

function projectStatusForRender(status: string): string {
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "FAILED") return "RENDER_FAILED";
  return "RENDERING";
}

async function persistRenderState(nextRender: RenderRecord): Promise<RenderRecord> {
  const updatedAt = new Date().toISOString();
  const persistedRender = { ...nextRender, updatedAt };

  await updateRenderStatus(
    persistedRender.projectId,
    persistedRender.renderId,
    persistedRender.status,
    {
      currentStage: persistedRender.currentStage,
      currentPage: persistedRender.currentPage,
      totalPages: persistedRender.totalPages,
      progressMessage: persistedRender.progressMessage,
      progressUpdatedAt: persistedRender.progressUpdatedAt,
      completedAt: persistedRender.completedAt,
      error: persistedRender.error,
    },
  );

  await updateProject(persistedRender.userId, persistedRender.projectId, {
    status: projectStatusForRender(persistedRender.status),
    latestRender: renderSummary(persistedRender),
  });

  return persistedRender;
}

function withProgress(
  render: RenderRecord,
  progress: RenderProgress | undefined,
  fallbackStage?: RenderProgress["stage"],
): RenderRecord {
  if (progress) {
    return {
      ...render,
      currentStage: progress.stage,
      currentPage: progress.currentPage,
      totalPages: progress.totalPages,
      progressMessage: progress.message,
      progressUpdatedAt: progress.updatedAt,
    };
  }

  return fallbackStage ? { ...render, currentStage: fallbackStage } : render;
}

function hasStateChanged(previous: RenderRecord, next: RenderRecord): boolean {
  return (
    previous.status !== next.status ||
    previous.currentStage !== next.currentStage ||
    previous.currentPage !== next.currentPage ||
    previous.totalPages !== next.totalPages ||
    previous.progressMessage !== next.progressMessage ||
    previous.progressUpdatedAt !== next.progressUpdatedAt ||
    previous.completedAt !== next.completedAt ||
    previous.error !== next.error
  );
}

export async function handleStartRender(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = requireAuth(event);
  const projectId = event.pathParameters?.id;
  if (!projectId) {
    throw new ApiError(400, "Missing project ID", "BAD_REQUEST");
  }

  // 所有者確認で取得したレコードをそのまま使い、同じ項目を二度読みしない。
  const project = await verifyProjectOwnership(projectId, userId);
  const body = validateBody(StartRenderSchema, event.body ?? null);

  if (project.latestRender?.status === "RUNNING") {
    const activeRender = await getRender(projectId, project.latestRender.renderId);
    if (activeRender) {
      const syncedActiveRender = await syncRenderStatus(activeRender);
      if (syncedActiveRender.status === "RUNNING") {
        throw new ApiError(
          409,
          "このプロジェクトでは動画生成が実行中です。完了または失敗を確認してから再実行してください。",
          "RENDER_ALREADY_RUNNING",
        );
      }
    }
  }

  const renderId = ulid();
  const now = new Date().toISOString();
  const startStage = body.startFromStage ?? "pages";

  // パイプラインは manifest.json だけを正本として読むため、開始前に S3 へ書き出す。
  const manifest = buildManifestFromProject(project);
  manifest.progress = createInitialProgress(startStage, manifest.pages.length, now);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: manifestKey({ userId, projectId }),
      Body: JSON.stringify(manifest, null, 2),
      ContentType: "application/json",
    }),
  );

  const executionInput = {
    projectId,
    userId,
    renderId,
    s3Bucket: BUCKET_NAME,
    s3Prefix: `users/${userId}/projects/${projectId}/`,
    startFromStage: startStage,
  };

  const executionResult = await sfnClient.send(
    new StartExecutionCommand({
      stateMachineArn: RENDER_STATE_MACHINE_ARN,
      name: `render-${renderId}`,
      input: JSON.stringify(executionInput),
    }),
  );

  const initialProgress = manifest.progress;
  const render: RenderRecord = {
    renderId,
    projectId,
    userId,
    status: "RUNNING",
    startedAt: now,
    updatedAt: now,
    currentStage: startStage,
    currentPage: initialProgress.currentPage,
    totalPages: initialProgress.totalPages,
    progressMessage: initialProgress.message,
    progressUpdatedAt: initialProgress.updatedAt,
    executionArn: executionResult.executionArn,
  };
  await createRender(render);
  await updateProject(userId, projectId, {
    status: "RENDERING",
    latestRender: renderSummary(render),
  });

  return buildResponse(201, {
    renderId,
    status: "RUNNING",
    startedAt: now,
    executionArn: executionResult.executionArn,
  });
}

export async function handleGetRenderStatus(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = requireAuth(event);
  const projectId = event.pathParameters?.id;
  const renderId = event.pathParameters?.renderId;
  if (!projectId || !renderId) {
    throw new ApiError(400, "Missing project ID or render ID", "BAD_REQUEST");
  }

  await verifyProjectOwnership(projectId, userId);

  const render = await getRender(projectId, renderId);
  if (!render) {
    throw new NotFoundError("Render not found");
  }

  const syncedRender = await syncRenderStatus(render);

  return buildResponse(200, {
    renderId: syncedRender.renderId,
    status: syncedRender.status,
    currentStage: syncedRender.currentStage,
    startedAt: syncedRender.startedAt,
    updatedAt: syncedRender.updatedAt,
    completedAt: syncedRender.completedAt,
    error: syncedRender.error,
    progress: progressFromRender(syncedRender),
  });
}

interface ListedArtifact {
  key: string;
  size?: number;
  lastModified?: string;
}

const DOWNLOADABLE_ARTIFACT_EXTENSIONS = [".mp4", ".srt", ".wav"];

function getSourceFileName(source: unknown): string | undefined {
  if (!source || typeof source !== "object") return undefined;
  const fileName = (source as { fileName?: unknown }).fileName;
  return typeof fileName === "string" && fileName.trim() ? fileName : undefined;
}

function replaceControlCharacters(value: string, replacement: string): string {
  return Array.from(value)
    .map((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint < 0x20 || codePoint === 0x7f)
        ? replacement
        : character;
    })
    .join("");
}

function safeDownloadBaseName(fileName: string | undefined, projectTitle: string): string {
  const rawCandidate = (fileName ?? projectTitle ?? "video")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/\.[^.]+$/, "")
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]/g, " ");
  const candidate = replaceControlCharacters(rawCandidate ?? "video", " ")
    .replace(/\s+/g, " ")
    .trim();
  const limited = Array.from(candidate || "video")
    .slice(0, 80)
    .join("");
  return limited || "video";
}

function jstTimestamp(startedAt: string): string {
  const date = new Date(startedAt);
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(validDate);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}${value("month")}${value("day")}-${value("hour")}${value("minute")}${value("second")}`;
}

/** 成果物ごとに元PDF名とレンダリング開始日時を使った保存名を作る。 */
export function buildArtifactDownloadName(
  sourceFileName: string | undefined,
  projectTitle: string,
  startedAt: string,
  artifactKey: string,
): string {
  const extension = artifactKey.split(".").pop()?.toLowerCase() || "bin";
  const suffix = extension === "srt" ? "_字幕" : extension === "wav" ? "_音声" : "";
  return `${safeDownloadBaseName(sourceFileName, projectTitle)}_${jstTimestamp(startedAt)}${suffix}.${extension}`;
}

function contentDisposition(downloadName: string): string {
  const extension =
    downloadName
      .split(".")
      .pop()
      ?.replace(/[^A-Za-z0-9]/g, "") || "bin";
  const fallback = `video-download.${extension}`;
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`;
}

export async function handleGetRenderArtifacts(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = requireAuth(event);
  const projectId = event.pathParameters?.id;
  const renderId = event.pathParameters?.renderId;
  if (!projectId || !renderId) {
    throw new ApiError(400, "Missing project ID or render ID", "BAD_REQUEST");
  }

  const project = await verifyProjectOwnership(projectId, userId);

  const render = await getRender(projectId, renderId);
  if (!render) {
    throw new NotFoundError("Render not found");
  }

  const projectPrefix = `users/${userId}/projects/${projectId}/`;
  const listedArtifacts = await listDownloadableArtifacts([
    `${projectPrefix}output/${renderId}/`,
    `${projectPrefix}captions/`,
    `${projectPrefix}audio/`,
  ]);
  const sourceFileName = getSourceFileName(project.source);

  const artifacts = await Promise.all(
    listedArtifacts.map(async (artifact) => {
      const downloadName = buildArtifactDownloadName(
        sourceFileName,
        project.title,
        render.startedAt,
        artifact.key,
      );
      return {
        ...artifact,
        downloadName,
        url: await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: artifact.key,
            ResponseContentDisposition: contentDisposition(downloadName),
          }),
          { expiresIn: 3600 },
        ),
      };
    }),
  );

  return buildResponse(200, { artifacts });
}

async function listDownloadableArtifacts(prefixes: string[]): Promise<ListedArtifact[]> {
  const artifactsByKey = new Map<string, ListedArtifact>();

  for (const prefix of prefixes) {
    let continuationToken: string | undefined;
    do {
      const listResult = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          Prefix: prefix,
          ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
        }),
      );

      for (const object of listResult.Contents ?? []) {
        if (!object.Key || !isDownloadableArtifact(object.Key)) continue;
        artifactsByKey.set(object.Key, {
          key: object.Key,
          size: object.Size,
          lastModified: object.LastModified?.toISOString(),
        });
      }

      continuationToken = listResult.IsTruncated ? listResult.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  return [...artifactsByKey.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function isDownloadableArtifact(key: string): boolean {
  const normalizedKey = key.toLowerCase();
  return DOWNLOADABLE_ARTIFACT_EXTENSIONS.some((extension) => normalizedKey.endsWith(extension));
}

async function readManifestProgress(render: RenderRecord): Promise<RenderProgress | undefined> {
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: manifestKey({ userId: render.userId, projectId: render.projectId }),
      }),
    );
    const body = await response.Body?.transformToString();
    if (!body) return undefined;
    const parsed = ManifestSchema.safeParse(JSON.parse(body));
    return parsed.success ? parsed.data.progress : undefined;
  } catch {
    // 進捗の一時的な読取失敗はStep Functionsの状態同期を妨げない。
    return undefined;
  }
}

async function syncRenderStatus(render: RenderRecord): Promise<RenderRecord> {
  if (!render.executionArn || render.status === "COMPLETED" || render.status === "FAILED") {
    return render;
  }

  let execution;
  try {
    execution = await sfnClient.send(
      new DescribeExecutionCommand({ executionArn: render.executionArn }),
    );
  } catch {
    // 状態照会に一時的に失敗しても、既知の状態を返してポーリングを継続可能にする。
    console.warn("レンダリング状態を Step Functions から同期できませんでした。", {
      renderId: render.renderId,
    });
    return render;
  }

  const manifestProgress = await readManifestProgress(render);

  if (execution.status === "SUCCEEDED") {
    const completedAt = execution.stopDate?.toISOString() ?? new Date().toISOString();
    const completed = withProgress(
      {
        ...render,
        status: "COMPLETED",
        completedAt,
      },
      manifestProgress,
      "video",
    );
    return persistRenderState(completed);
  }

  if (
    execution.status === "FAILED" ||
    execution.status === "TIMED_OUT" ||
    execution.status === "ABORTED"
  ) {
    const completedAt = execution.stopDate?.toISOString() ?? new Date().toISOString();
    const failed = withProgress(
      {
        ...render,
        status: "FAILED",
        completedAt,
        error: RENDER_FAILED_ERROR,
      },
      manifestProgress,
    );
    return persistRenderState(failed);
  }

  if (execution.status !== "RUNNING" && execution.status !== "PENDING_REDRIVE") {
    return render;
  }

  const historyStage = await findCurrentStage(render.executionArn, render.currentStage);
  const synced = withProgress(render, manifestProgress, historyStage);
  if (!hasStateChanged(render, synced)) {
    return render;
  }

  return persistRenderState(synced);
}

async function findCurrentStage(
  executionArn: string,
  fallbackStage: string | undefined,
): Promise<RenderProgress["stage"] | undefined> {
  try {
    const history = await sfnClient.send(
      new GetExecutionHistoryCommand({
        executionArn,
        reverseOrder: true,
        maxResults: 100,
      }),
    );

    for (const event of history.events ?? []) {
      if (event.type !== "TaskStateEntered") continue;
      const stage = stageByStateName[event.stateEnteredEventDetails?.name ?? ""];
      if (stage) return stage;
    }
  } catch {
    // 履歴照会に失敗しても、DescribeExecution の結果は有効なので既知の工程を維持する。
    console.warn("レンダリング工程を Step Functions 履歴から取得できませんでした。");
  }

  return isRenderStage(fallbackStage) ? fallbackStage : undefined;
}
