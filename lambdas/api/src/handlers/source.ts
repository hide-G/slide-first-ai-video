/**
 * Source API handlers:
 *   POST /projects/{id}/source-upload-url - Get presigned upload URL
 *   POST /projects/{id}/source - Register uploaded source
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  requireAuth,
  verifyProjectOwnership,
  validateBody,
  SourceUploadUrlSchema,
  RegisterSourceSchema,
  buildResponse,
  ApiError,
} from "../middleware/index.js";
import { updateProject } from "../db/index.js";

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME ?? "";

export async function handleSourceUploadUrl(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = requireAuth(event);
  const projectId = event.pathParameters?.id;
  if (!projectId) {
    throw new ApiError(400, "Missing project ID", "BAD_REQUEST");
  }

  await verifyProjectOwnership(projectId, userId);
  const body = validateBody(SourceUploadUrlSchema, event.body ?? null);

  // Determine the S3 key for the uploaded file
  const ext = body.fileName.split(".").pop() ?? "pdf";
  const fileKey = `users/${userId}/projects/${projectId}/input/source.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
    ContentType: body.contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  return buildResponse(200, {
    uploadUrl,
    fileKey,
  });
}

export async function handleRegisterSource(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = requireAuth(event);
  const projectId = event.pathParameters?.id;
  if (!projectId) {
    throw new ApiError(400, "Missing project ID", "BAD_REQUEST");
  }

  await verifyProjectOwnership(projectId, userId);
  const body = validateBody(RegisterSourceSchema, event.body ?? null);

  await updateProject(userId, projectId, {
    source: {
      kind: body.kind,
      fileKey: body.fileKey,
      pageCount: body.pageCount,
    },
    status: "SOURCE_REGISTERED",
  });

  return buildResponse(200, {
    source: {
      kind: body.kind,
      fileKey: body.fileKey,
      pageCount: body.pageCount,
    },
  });
}
