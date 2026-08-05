/**
 * GET /v1/jobs/{jobId} - Get job status and progress.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  extractUserId,
  buildResponse,
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  ApiError,
} from "../middleware/index.js";
import { getJob } from "../db/index.js";

/**
 * Stage-specific progress messages (from design section 14).
 */
const STAGE_MESSAGES: Record<string, string> = {
  PENDING: "Job queued, waiting to start",
  SLIDE_GENERATING: "Generating slide content with AI",
  SLIDE_READY: "Slides generated successfully",
  RENDERING_AUDIO: "Synthesizing audio narration",
  RENDERING_SLIDES: "Rendering slide images",
  COMPOSITING: "Building final video composition",
  ENCODING: "Encoding video output",
  SUCCEEDED: "Processing complete",
  FAILED: "Processing failed",
  CANCELLED: "Job was cancelled",
};

export async function handleGetJob(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const userId = extractUserId(event);
  if (!userId) {
    throw new UnauthorizedError();
  }

  const jobId = event.pathParameters?.jobId;
  if (!jobId) {
    throw new ApiError(400, "Missing job ID", "MISSING_PARAMETER");
  }

  const job = await getJob(jobId);
  if (!job) {
    throw new NotFoundError("Job not found");
  }

  // Only the job owner can view it
  if (job.userId !== userId) {
    throw new ForbiddenError("Access denied");
  }

  const progress =
    job.progress ?? STAGE_MESSAGES[job.status] ?? "Processing";

  return buildResponse(200, {
    jobId: job.jobId,
    projectId: job.projectId,
    type: job.type,
    status: job.status,
    progress,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
}
