/**
 * Deck API handler:
 *   POST /projects/{id}/deck - Generate slides via Marp (invoke marp-render)
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import {
  requireAuth,
  verifyProjectOwnership,
  validateBody,
  GenerateDeckSchema,
  buildResponse,
  ApiError,
} from "../middleware/index.js";
import { getProject, updateProject } from "../db/index.js";

const lambdaClient = new LambdaClient({});
const MARP_LAMBDA_ARN = process.env.MARP_LAMBDA_ARN ?? "";
const BUCKET_NAME = process.env.BUCKET_NAME ?? "";

export async function handleGenerateDeck(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = requireAuth(event);
  const projectId = event.pathParameters?.id;
  if (!projectId) {
    throw new ApiError(400, "Missing project ID", "BAD_REQUEST");
  }

  await verifyProjectOwnership(projectId, userId);
  const body = validateBody(GenerateDeckSchema, event.body ?? null);

  // Get project to access outline
  const project = await getProject(projectId);
  if (!project || !project.outline) {
    throw new ApiError(400, "Project outline must be confirmed before deck generation", "OUTLINE_REQUIRED");
  }

  // Invoke marp-render Lambda
  const payload = {
    action: "generateDeck",
    projectId,
    userId,
    outline: project.outline,
    theme: body.theme,
    s3Bucket: BUCKET_NAME,
    s3Prefix: `users/${userId}/projects/${projectId}/`,
  };

  const response = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: MARP_LAMBDA_ARN,
      Payload: Buffer.from(JSON.stringify(payload)),
    }),
  );

  if (response.FunctionError) {
    const errorPayload = response.Payload
      ? JSON.parse(Buffer.from(response.Payload).toString())
      : { errorMessage: "Unknown error" };
    throw new ApiError(
      502,
      `Deck generation failed: ${errorPayload.errorMessage ?? "Unknown"}`,
      "GENERATION_FAILED",
    );
  }

  const result = response.Payload
    ? JSON.parse(Buffer.from(response.Payload).toString())
    : {};

  await updateProject(userId, projectId, {
    source: result.source,
    status: "DECK_GENERATED",
  });

  return buildResponse(200, {
    source: result.source,
    deckKey: result.deckKey,
    pageCount: result.pageCount,
  });
}
