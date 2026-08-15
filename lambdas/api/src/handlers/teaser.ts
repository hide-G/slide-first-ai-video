/**
 * POST /v1/projects/{id}/videos/teaser - Start teaser video generation.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ulid } from "ulid";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import {
  extractUserId,
  extractIdempotencyKey,
  validateBody,
  StartVideoSchema,
  buildResponse,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ApiError,
} from "../middleware/index.js";
import {
  getProject,
  getVersion,
  updateProjectStatus,
  createJob,
  putIfAbsent,
  completeIdempotencyRecord,
} from "../db/index.js";

const sfnClient = new SFNClient({});
const TEASER_STATE_MACHINE_ARN =
  process.env.TEASER_STATE_MACHINE_ARN ?? "";

export async function handleStartTeaser(
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

  // Check idempotency
  const idempotencyKey = extractIdempotencyKey(event);
  if (idempotencyKey) {
    const existing = await putIfAbsent(idempotencyKey, userId);
    if (existing && existing.responseStatus > 0) {
      return {
        statusCode: existing.responseStatus,
        headers: { "Content-Type": "application/json" },
        body: existing.responseBody,
      };
    }
  }

  // Validate project ownership
  const project = await getProject(projectId);
  if (!project) {
    throw new NotFoundError("Project not found");
  }
  if (project.userId !== userId) {
    throw new ForbiddenError("Access denied");
  }

  const body = validateBody(StartVideoSchema, event.body ?? "{}");
  const versionNumber = body.versionNumber;

  // Validate version is SLIDE_APPROVED
  const version = await getVersion(projectId, versionNumber);
  if (!version) {
    throw new NotFoundError("Version not found");
  }

  if (version.status !== "SLIDE_APPROVED") {
    throw new ConflictError(
      `Cannot start teaser for version in state ${version.status}. Must be SLIDE_APPROVED.`,
    );
  }

  // Create job record
  const jobId = ulid();
  const now = new Date().toISOString();

  await createJob({
    jobId,
    projectId,
    userId,
    versionNumber,
    type: "RENDER",
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
  });

  // Start Step Functions execution with teaser output type
  const executionInput = JSON.stringify({
    projectId,
    userId,
    versionNumber,
    jobId,
    outputTypes: ["x-teaser-16x9"],
  });

  if (TEASER_STATE_MACHINE_ARN) {
    await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn: TEASER_STATE_MACHINE_ARN,
        name: `teaser-${jobId}`,
        input: executionInput,
      }),
    );
  }

  // Update project status
  await updateProjectStatus(projectId, "ASSET_BUILDING");

  const responseBody = JSON.stringify({ jobId, projectId, status: "PENDING" });

  if (idempotencyKey) {
    await completeIdempotencyRecord(idempotencyKey, userId, 202, responseBody);
  }

  return buildResponse(202, { jobId, projectId, status: "PENDING" });
}
