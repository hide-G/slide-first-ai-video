/**
 * GET /v1/projects/{id}/versions/{version} - Get version markdown and metadata.
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { buildVersionPrefix } from "@slide-first/core";
import {
  extractUserId,
  buildResponse,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ApiError,
} from "../middleware/index.js";
import { getProject, getVersion } from "../db/index.js";

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME ?? "";

export async function handleGetVersion(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = extractUserId(event);
  if (!userId) {
    throw new UnauthorizedError();
  }

  const projectId = event.pathParameters?.id;
  const versionStr = event.pathParameters?.version;
  if (!projectId || !versionStr) {
    throw new ApiError(400, "Missing path parameters", "MISSING_PARAMETER");
  }

  const versionNumber = parseInt(versionStr, 10);
  if (isNaN(versionNumber) || versionNumber < 1) {
    throw new ApiError(400, "Invalid version number", "INVALID_PARAMETER");
  }

  // Validate project ownership
  const project = await getProject(projectId);
  if (!project) {
    throw new NotFoundError("Project not found");
  }
  if (project.userId !== userId) {
    throw new ForbiddenError("Access denied");
  }

  // Get version metadata
  const version = await getVersion(projectId, versionNumber);
  if (!version) {
    throw new NotFoundError("Version not found");
  }

  // Read deck.md from S3
  const prefix = buildVersionPrefix({
    userId,
    projectId,
    versionNumber,
  });
  const deckKey = `${prefix}deck.md`;

  let markdown = "";
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: deckKey,
      }),
    );
    markdown = (await response.Body?.transformToString()) ?? "";
  } catch {
    // deck.md may not exist yet if still generating
    markdown = "";
  }

  return buildResponse(200, {
    projectId,
    versionNumber: version.versionNumber,
    status: version.status,
    slideCount: version.slideCount,
    markdown,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
  });
}
