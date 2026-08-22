/**
 * 工程4: Video - MediaConvertジョブを送信するLambdaハンドラー。
 *
 * manifest.outputを出力サイズとfpsの唯一の正本として使い、必要に応じて
 * captions/captions.srtを同じMP4出力へ焼き込む。
 */

import {
  MediaConvertClient,
  CreateJobCommand,
  GetJobCommand,
  DescribeEndpointsCommand,
} from "@aws-sdk/client-mediaconvert";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { Manifest } from "@slide-first/shared-types";
import { pageImageKey, audioKey, captionsSrtKey } from "@slide-first/shared-types";
import { buildMediaConvertJob } from "./job-builder.js";

const MEDIACONVERT_ROLE_ARN = process.env.MEDIACONVERT_ROLE_ARN ?? "";
const BUCKET_NAME = process.env.BUCKET_NAME ?? "";
const REGION = process.env.AWS_REGION ?? "ap-northeast-1";

const s3Client = new S3Client({});

/** アカウント固有のMediaConvertエンドポイントをLambda環境内で再利用する。 */
let cachedEndpoint: string | undefined;
async function getMediaConvertEndpoint(): Promise<string> {
  if (cachedEndpoint) return cachedEndpoint;

  const envEndpoint = process.env.MEDIACONVERT_ENDPOINT;
  if (envEndpoint) {
    cachedEndpoint = envEndpoint;
    return cachedEndpoint;
  }

  const client = new MediaConvertClient({ region: REGION });
  const response = await client.send(new DescribeEndpointsCommand({ MaxResults: 1 }));
  const endpoint = response.Endpoints?.[0]?.Url;
  if (!endpoint) {
    throw new Error("MediaConvertのDescribeEndpointsからエンドポイントを取得できませんでした。");
  }
  cachedEndpoint = endpoint;
  return cachedEndpoint;
}

/** @internal テスト用にエンドポイントキャッシュを初期化する。 */
export function _resetEndpointCache(): void {
  cachedEndpoint = undefined;
}

const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_ATTEMPTS = 85;

export interface VideoEvent {
  s3Bucket: string;
  s3Prefix: string;
  projectId: string;
  userId: string;
  renderId: string;
  stage?: string;
}

export interface VideoResult {
  success: boolean;
  outputDurationMs: number;
  error?: string;
}

/** 工程4: VideoのLambdaハンドラー。 */
export const handler = async (event: VideoEvent): Promise<VideoResult> => {
  const bucket = event.s3Bucket || BUCKET_NAME;
  const manifestKey = `${event.s3Prefix}manifest.json`;
  const manifest = await readManifest(bucket, manifestKey);

  try {
    const endpoint = await getMediaConvertEndpoint();
    const mediaConvertClient = new MediaConvertClient({
      endpoint,
      region: REGION,
    });

    manifest.stages.video = "running";
    updateVideoProgress(manifest, 0, manifest.pages.length, "動画エンコードを開始しています。");
    await writeManifest(bucket, manifestKey, manifest);

    const keyParams = {
      userId: manifest.userId,
      projectId: manifest.projectId,
    };
    const pages = manifest.pages.map((page) => ({
      pageNumber: page.pageNumber,
      frameAlignedDurationMs: page.frameAlignedDurationMs,
      imageS3Uri: `s3://${bucket}/${pageImageKey(keyParams, page.pageNumber)}`,
      audioS3Uri: `s3://${bucket}/${audioKey(keyParams, page.pageNumber)}`,
    }));

    const outputDestination = `s3://${bucket}/users/${manifest.userId}/projects/${manifest.projectId}/output/${event.renderId}/`;
    const captionsSrtS3Uri =
      manifest.output.captions === "burn"
        ? `s3://${bucket}/${captionsSrtKey(keyParams)}`
        : undefined;

    const jobSettings = buildMediaConvertJob({
      roleArn: MEDIACONVERT_ROLE_ARN,
      pages,
      outputDestination,
      output: manifest.output,
      captionsSrtS3Uri,
      captionLanguageCode: manifest.contentLanguage,
    });

    const createResponse = await mediaConvertClient.send(
      new CreateJobCommand(jobSettings as unknown as Record<string, unknown>),
    );

    const jobId = createResponse.Job?.Id;
    if (!jobId) {
      throw new Error("MediaConvertのCreateJobがジョブIDを返しませんでした。");
    }

    updateVideoProgress(
      manifest,
      manifest.pages.length,
      manifest.pages.length,
      "MediaConvertで動画をエンコードしています。",
    );
    await writeManifest(bucket, manifestKey, manifest);

    let outputDurationMs = 0;
    let jobCompleted = false;
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS);
      const getResponse = await mediaConvertClient.send(new GetJobCommand({ Id: jobId }));
      const status = getResponse.Job?.Status;

      if (status === "COMPLETE") {
        outputDurationMs =
          getResponse.Job?.OutputGroupDetails?.[0]?.OutputDetails?.[0]?.DurationInMs ?? 0;
        jobCompleted = true;
        break;
      }

      if (status === "ERROR" || status === "CANCELED") {
        const errorMessage = getResponse.Job?.ErrorMessage ?? `Job ${status}`;
        throw new Error(`MediaConvertジョブに失敗しました: ${errorMessage}`);
      }
    }

    if (!jobCompleted) {
      throw new Error(
        `MediaConvertジョブ ${jobId} は${MAX_POLL_ATTEMPTS}回の確認後も完了しませんでした。`,
      );
    }

    manifest.stages.video = "done";
    updateVideoProgress(
      manifest,
      manifest.pages.length,
      manifest.pages.length,
      "動画生成が完了しました。",
    );
    const outputDurationSec = outputDurationMs / 1000;
    if (!manifest.cost) {
      manifest.cost = {
        currency: "USD",
        priceListFetchedAt: new Date().toISOString(),
        stages: [],
        estimatedTotal: 0,
        actual: { status: "pending", amount: null, reconciledAt: null },
      };
    }
    manifest.cost.stages.push({
      stage: "video",
      service: "mediaconvert",
      usage: {
        outputDurationSec,
        outputResolution: `${manifest.output.width}x${manifest.output.height}`,
      },
      estimatedCost: 0.0,
    });

    await writeManifest(bucket, manifestKey, manifest);
    return { success: true, outputDurationMs };
  } catch (error: unknown) {
    manifest.stages.video = "failed";
    updateVideoProgress(
      manifest,
      manifest.progress?.currentPage ?? 0,
      manifest.pages.length,
      "動画生成に失敗しました。",
    );
    await writeManifest(bucket, manifestKey, manifest);

    const message = error instanceof Error ? error.message : String(error);
    return { success: false, outputDurationMs: 0, error: message };
  }
};

function updateVideoProgress(
  manifest: Manifest,
  currentPage: number,
  totalPages: number,
  message: string,
): void {
  manifest.progress = {
    stage: "video",
    currentPage,
    totalPages: Math.max(1, totalPages),
    message,
    updatedAt: new Date().toISOString(),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readManifest(bucket: string, key: string): Promise<Manifest> {
  const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await response.Body!.transformToString();
  return JSON.parse(body) as Manifest;
}

async function writeManifest(bucket: string, key: string, manifest: Manifest): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(manifest, null, 2),
      ContentType: "application/json",
    }),
  );
}
