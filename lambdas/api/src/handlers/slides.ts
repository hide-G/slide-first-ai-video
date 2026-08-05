/**
 * POST /v1/projects/{id}/slides - Start slide generation.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ulid } from "ulid";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import {
  extractUserId,
  extractIdempotencyKey,
  validateBody,
  StartSlidesSchema,
  buildResponse,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ApiError,
} from "../middleware/index.js";
import {
  getProject,
  updateProjectStatus,
  createJob,
  putIfAbsent,
  completeIdempotencyRecord,
} from "../db/index.js";

const sfnClient = new SFNClient({});
const CONTENT_STATE_MACHINE_ARN =
  process.env.CONTENT_STATE_MACHINE_ARN ?? "";

export async function handleStartSlides(
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

  const body = validateBody(StartSlidesSchema, event.body ?? "{}");

  // Create job record
  const jobId = ulid();
  const now = new Date().toISOString();
  const versionNumber = project.currentVersion + 1;

  await createJob({
    jobId,
    projectId,
    userId,
    versionNumber,
    type: "GENERATE",
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
  });

  // Start Step Functions execution
  const executionInput = JSON.stringify({
    projectId,
    userId,
    versionNumber,
    theme: body.theme ?? project.theme,
    audience: body.audience ?? project.audience,
    duration: body.duration ?? project.duration,
    urls: body.urls ?? project.urls,
    jobId,
  });

  if (CONTENT_STATE_MACHINE_ARN) {
    await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn: CONTENT_STATE_MACHINE_ARN,
        name: `slides-${jobId}`,
        input: executionInput,
      }),
    );
  }

  // Update project status
  await updateProjectStatus(projectId, "SLIDE_GENERATING");

  const responseBody = JSON.stringify({ jobId, projectId, status: "PENDING" });

  if (idempotencyKey) {
    await completeIdempotencyRecord(idempotencyKey, userId, 202, responseBody);
  }

  return buildResponse(202, { jobId, projectId, status: "PENDING" });
}
