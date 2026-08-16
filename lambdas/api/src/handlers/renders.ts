/**
 * Render API handlers:
 *   POST /projects/{id}/renders - Start render pipeline
 *   GET  /projects/{id}/renders/{renderId} - Get render status
 *   GET  /projects/{id}/renders/{renderId}/artifacts - Get artifacts (presigned URLs)
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ulid } from "ulid";
import {
  requireAuth,
  verifyProjectOwnership,
  validateBody,
  StartRenderSchema,
  buildResponse,
  ApiError,
  NotFoundError,
} from "../middleware/index.js";
import { createRender, getRender, getProject } from "../db/index.js";
import { buildManifestFromProject } from "../manifest/build-manifest.js";
import { manifestKey } from "@slide-first/shared-types";

const sfnClient = new SFNClient({});
const s3Client = new S3Client({});
const RENDER_STATE_MACHINE_ARN = process.env.RENDER_STATE_MACHINE_ARN ?? "";
const BUCKET_NAME = process.env.BUCKET_NAME ?? "";

export async function handleStartRender(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = requireAuth(event);
  const projectId = event.pathParameters?.id;
  if (!projectId) {
    throw new ApiError(400, "Missing project ID", "BAD_REQUEST");
  }

  // 所有者確認で取得したレコードをそのまま使う（同じ項目を二度読まない）
  const project = await verifyProjectOwnership(projectId, userId);
  const body = validateBody(StartRenderSchema, event.body ?? null);

  const renderId = ulid();
  const now = new Date().toISOString();

  // パイプラインは manifest.json だけを正本として読む。
  // APIはDynamoDBに保存しているため、実行開始前にS3へ書き出して橋渡しする。
  // これを省くと工程1が manifest.json を見つけられず失敗する。
  const manifest = buildManifestFromProject(project);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: manifestKey({ userId, projectId }),
      Body: JSON.stringify(manifest, null, 2),
      ContentType: "application/json",
    }),
  );

  // Start Step Functions execution
  const executionInput = {
    projectId,
    userId,
    renderId,
    s3Bucket: BUCKET_NAME,
    s3Prefix: `users/${userId}/projects/${projectId}/`,
    startFromStage: body.startFromStage ?? "pages",
  };

  const executionResult = await sfnClient.send(
    new StartExecutionCommand({
      stateMachineArn: RENDER_STATE_MACHINE_ARN,
      name: `render-${renderId}`,
      input: JSON.stringify(executionInput),
    }),
  );

  // Save render record
  await createRender({
    renderId,
    projectId,
    userId,
    status: "RUNNING",
    startedAt: now,
    updatedAt: now,
    currentStage: body.startFromStage ?? "pages",
    executionArn: executionResult.executionArn,
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

  return buildResponse(200, {
    renderId: render.renderId,
    status: render.status,
    currentStage: render.currentStage,
    startedAt: render.startedAt,
    updatedAt: render.updatedAt,
    completedAt: render.completedAt,
    error: render.error,
  });
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

  await verifyProjectOwnership(projectId, userId);

  const render = await getRender(projectId, renderId);
  if (!render) {
    throw new NotFoundError("Render not found");
  }

  // List output artifacts from S3
  const outputPrefix = `users/${userId}/projects/${projectId}/output/${renderId}/`;
  const listResult = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: outputPrefix,
    }),
  );

  const artifacts = [];
  for (const obj of listResult.Contents ?? []) {
    if (!obj.Key) continue;
    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: obj.Key }),
      { expiresIn: 3600 },
    );
    artifacts.push({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified?.toISOString(),
      url,
    });
  }

  return buildResponse(200, { artifacts });
}
