/**
 * Output API handler:
 *   PUT /projects/{id}/output - Save output settings
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  requireAuth,
  verifyProjectOwnership,
  validateBody,
  SaveOutputSchema,
  buildResponse,
  ApiError,
} from "../middleware/index.js";
import { updateProject } from "../db/index.js";

export async function handleSaveOutput(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = requireAuth(event);
  const projectId = event.pathParameters?.id;
  if (!projectId) {
    throw new ApiError(400, "Missing project ID", "BAD_REQUEST");
  }

  await verifyProjectOwnership(projectId, userId);
  const body = validateBody(SaveOutputSchema, event.body ?? null);

  const output = {
    aspect: body.aspect,
    width: body.width,
    height: body.height,
    fps: body.fps,
    captions: body.captions,
    verticalLayout: body.verticalLayout ?? null,
    padColor: body.padColor ?? null,
  };

  await updateProject(userId, projectId, {
    output,
    status: "OUTPUT_CONFIGURED",
  });

  return buildResponse(200, { output });
}
