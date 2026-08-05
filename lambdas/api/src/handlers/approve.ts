/**
 * POST /v1/projects/{id}/versions/{version}/approve - Approve slides.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  extractUserId,
  buildResponse,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ApiError,
} from "../middleware/index.js";
import { getProject, getVersion, updateVersionStatus } from "../db/index.js";

export async function handleApprove(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
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

  // Validate version exists and is in correct state
  const version = await getVersion(projectId, versionNumber);
  if (!version) {
    throw new NotFoundError("Version not found");
  }

  if (version.status !== "SLIDE_READY") {
    throw new ConflictError(
      `Cannot approve version in state ${version.status}. Must be SLIDE_READY.`,
    );
  }

  // Transition to SLIDE_APPROVED
  await updateVersionStatus(projectId, versionNumber, "SLIDE_APPROVED");

  return buildResponse(200, {
    projectId,
    versionNumber,
    status: "SLIDE_APPROVED",
  });
}
