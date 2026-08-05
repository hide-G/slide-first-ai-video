/**
 * Render Worker Lambda handler.
 * Dispatches plan/renderChunk/assemble actions to the FFmpeg renderer.
 *
 * This Lambda is invoked by the Render State Machine with an action field
 * that determines which renderer method to call.
 */

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { FfmpegRenderer } from "@slide-first/renderer-ffmpeg";
import type {
  RenderInput,
  RenderPlan,
  ChunkResult,
  RenderOutput,
} from "@slide-first/renderer-port";
import type { VideoManifest } from "@slide-first/shared-types";

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME ?? "";

/** Fetch a video manifest JSON from S3 */
async function fetchManifest(
  bucket: string,
  key: string,
): Promise<VideoManifest> {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const body = await response.Body?.transformToString();
  if (!body) {
    throw new Error(`Failed to read manifest from s3://${bucket}/${key}`);
  }
  return JSON.parse(body) as VideoManifest;
}

/** Resolve an S3 key to a local EFS/tmp path for ffmpeg processing */
function resolveS3Path(bucket: string, key: string): string {
  // In Lambda, files are staged to /tmp for local ffmpeg processing
  return `/tmp/${key.replace(/\//g, "_")}`;
}

const renderer = new FfmpegRenderer({
  fetchManifest,
  resolveS3Path,
});

/** Event types for the render worker */
export interface PlanEvent {
  action: "plan";
  input: RenderInput;
}

export interface RenderChunkEvent {
  action: "renderChunk";
  chunk: {
    plan: RenderPlan;
    chunkIndex: number;
  };
}

export interface AssembleEvent {
  action: "assemble";
  planResult: {
    Payload: RenderPlan;
  };
  chunkResults: Array<{
    chunkResult: {
      Payload: ChunkResult;
    };
  }>;
}

export type RenderWorkerEvent = PlanEvent | RenderChunkEvent | AssembleEvent;

/**
 * Lambda handler that dispatches to the FFmpeg renderer based on action field.
 */
export const handler = async (
  event: RenderWorkerEvent,
): Promise<RenderPlan | ChunkResult | RenderOutput> => {
  switch (event.action) {
    case "plan": {
      const input: RenderInput = {
        ...event.input,
        bucket: event.input.bucket || BUCKET_NAME,
      };
      return renderer.plan(input);
    }

    case "renderChunk": {
      const { plan, chunkIndex } = event.chunk;
      return renderer.renderChunk(plan, chunkIndex);
    }

    case "assemble": {
      const plan = event.planResult.Payload;
      const chunks = event.chunkResults.map((r) => r.chunkResult.Payload);
      return renderer.assemble(plan, chunks);
    }

    default: {
      const exhaustive: never = event;
      throw new Error(
        `Unknown action: ${(exhaustive as { action: string }).action}`,
      );
    }
  }
};
