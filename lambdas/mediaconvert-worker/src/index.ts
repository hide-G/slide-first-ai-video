/**
 * Stage 4: Video - MediaConvert job submission Lambda handler.
 *
 * Reads manifest from S3, builds a MediaConvert job JSON matching
 * the verified template (design doc section 2.1), submits the job,
 * polls for completion, and updates manifest.stages.video.
 *
 * The output duration is read from GetJob response:
 *   Job.OutputGroupDetails[0].OutputDetails[0].DurationInMs
 */

import {
  MediaConvertClient,
  CreateJobCommand,
  GetJobCommand,
} from "@aws-sdk/client-mediaconvert";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { Manifest } from "@slide-first/shared-types";
import { pageImageKey, audioKey } from "@slide-first/shared-types";
import { buildMediaConvertJob } from "./job-builder.js";

const MEDIACONVERT_ENDPOINT = process.env.MEDIACONVERT_ENDPOINT;
const MEDIACONVERT_ROLE_ARN = process.env.MEDIACONVERT_ROLE_ARN ?? "";
const BUCKET_NAME = process.env.BUCKET_NAME ?? "";
const REGION = process.env.AWS_REGION ?? "ap-northeast-1";

const s3Client = new S3Client({});
const mediaConvertClient = new MediaConvertClient({
  endpoint: MEDIACONVERT_ENDPOINT,
  region: REGION,
});

/** Polling interval in milliseconds */
const POLL_INTERVAL_MS = 10_000;
/** Maximum polling attempts (10s * 180 = 30 min max) */
const MAX_POLL_ATTEMPTS = 180;

export interface VideoEvent {
  /** S3 bucket name (from state machine payload) */
  s3Bucket: string;
  /** S3 prefix e.g. "users/{userId}/projects/{projectId}/" */
  s3Prefix: string;
  /** Project ID */
  projectId: string;
  /** User ID */
  userId: string;
  /** Render ID */
  renderId: string;
  /** Stage name */
  stage?: string;
}

export interface VideoResult {
  success: boolean;
  outputDurationMs: number;
  error?: string;
}

/**
 * Lambda handler for Stage 4: Video.
 */
export const handler = async (event: VideoEvent): Promise<VideoResult> => {
  const bucket = event.s3Bucket || BUCKET_NAME;
  const manifestKey = `${event.s3Prefix}manifest.json`;

  // 1. Read manifest
  const manifest = await readManifest(bucket, manifestKey);

  try {
    // 2. Update stage to running
    manifest.stages.video = "running";
    await writeManifest(bucket, manifestKey, manifest);

    // 3. Build MediaConvert job
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

    const jobSettings = buildMediaConvertJob({
      roleArn: MEDIACONVERT_ROLE_ARN,
      pages,
      outputDestination,
    });

    // 4. Submit job
    const createResponse = await mediaConvertClient.send(
      new CreateJobCommand(jobSettings as unknown as Record<string, unknown>),
    );

    const jobId = createResponse.Job?.Id;
    if (!jobId) {
      throw new Error("MediaConvert CreateJob did not return a job ID");
    }

    // 5. Poll for completion
    let outputDurationMs = 0;
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS);

      const getResponse = await mediaConvertClient.send(
        new GetJobCommand({ Id: jobId }),
      );

      const status = getResponse.Job?.Status;

      if (status === "COMPLETE") {
        outputDurationMs =
          getResponse.Job?.OutputGroupDetails?.[0]?.OutputDetails?.[0]
            ?.DurationInMs ?? 0;
        break;
      }

      if (status === "ERROR" || status === "CANCELED") {
        const errorMessage =
          getResponse.Job?.ErrorMessage ?? `Job ${status}`;
        throw new Error(`MediaConvert job failed: ${errorMessage}`);
      }

      // SUBMITTED or PROGRESSING - continue polling
    }

    // 6. Update stage to done and add cost entry
    manifest.stages.video = "done";

    // Add MediaConvert cost entry to manifest
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
        outputResolution: "1920x1080",
      },
      estimatedCost: 0.0,
    });

    await writeManifest(bucket, manifestKey, manifest);

    return { success: true, outputDurationMs };
  } catch (error: unknown) {
    manifest.stages.video = "failed";
    await writeManifest(bucket, manifestKey, manifest);

    const message = error instanceof Error ? error.message : String(error);
    return { success: false, outputDurationMs: 0, error: message };
  }
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readManifest(bucket: string, key: string): Promise<Manifest> {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const body = await response.Body!.transformToString();
  return JSON.parse(body) as Manifest;
}

async function writeManifest(
  bucket: string,
  key: string,
  manifest: Manifest,
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(manifest, null, 2),
      ContentType: "application/json",
    }),
  );
}
