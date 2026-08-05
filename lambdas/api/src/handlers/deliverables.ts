/**
 * GET /v1/projects/{id}/deliverables - List deliverables with presigned URLs.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { buildVersionPrefix } from "@slide-first/core";
import {
  extractUserId,
  buildResponse,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ApiError,
} from "../middleware/index.js";
import { getProject } from "../db/index.js";

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME ?? "";
const PRESIGN_EXPIRY = 900; // 15 minutes

/** Map file extensions to deliverable types */
function getDeliverableType(
  key: string,
): "pdf" | "pptx" | "mp4" | "vtt" | "srt" | null {
  if (key.endsWith(".pdf")) return "pdf";
  if (key.endsWith(".pptx")) return "pptx";
  if (key.endsWith(".mp4")) return "mp4";
  if (key.endsWith(".vtt")) return "vtt";
  if (key.endsWith(".srt")) return "srt";
  return null;
}

/** Extract filename from S3 key */
function getFilename(key: string): string {
  return key.split("/").pop() ?? key;
}

export interface Deliverable {
  type: "pdf" | "pptx" | "mp4" | "vtt" | "srt";
  filename: string;
  url: string;
  size: number;
  createdAt: string;
}

export async function handleGetDeliverables(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const userId = extractUserId(event);
  if (!userId) {
    throw new UnauthorizedError();
  }

  const projectId = event.pathParameters?.id;
  if (!projectId) {
    throw new ApiError(400, "Missing project ID", "MISSING_PARAMETER");
  }

  // Validate project ownership
  const project = await getProject(projectId);
  if (!project) {
    throw new NotFoundError("Project not found");
  }
  if (project.userId !== userId) {
    throw new ForbiddenError("Access denied");
  }

  // List objects in the version's output and captions directories
  const versionNumber = project.currentVersion;
  if (versionNumber < 1) {
    return buildResponse(200, { deliverables: [] });
  }

  const prefix = buildVersionPrefix({
    userId,
    projectId,
    versionNumber,
  });

  // List all objects under the version prefix
  const listResult = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
    }),
  );

  const contents = listResult.Contents ?? [];
  const deliverables: Deliverable[] = [];

  for (const obj of contents) {
    if (!obj.Key || !obj.Size) continue;

    const type = getDeliverableType(obj.Key);
    if (!type) continue;

    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: obj.Key,
      }),
      { expiresIn: PRESIGN_EXPIRY },
    );

    deliverables.push({
      type,
      filename: getFilename(obj.Key),
      url,
      size: obj.Size,
      createdAt: obj.LastModified?.toISOString() ?? "",
    });
  }

  return buildResponse(200, { deliverables });
}
