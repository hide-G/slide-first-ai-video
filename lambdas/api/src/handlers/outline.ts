/**
 * Outline API handlers:
 *   POST /projects/{id}/outline - Generate outline via Bedrock (invoke slide-generator)
 *   PUT  /projects/{id}/outline - Save confirmed outline
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import {
  requireAuth,
  verifyProjectOwnership,
  validateBody,
  GenerateOutlineSchema,
  SaveOutlineSchema,
  buildResponse,
  ApiError,
} from "../middleware/index.js";
import { updateProject } from "../db/index.js";

const lambdaClient = new LambdaClient({});
const SLIDE_GENERATOR_ARN = process.env.SLIDE_GENERATOR_ARN ?? "";

export async function handleGenerateOutline(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = requireAuth(event);
  const projectId = event.pathParameters?.id;
  if (!projectId) {
    throw new ApiError(400, "Missing project ID", "BAD_REQUEST");
  }

  await verifyProjectOwnership(projectId, userId);
  const body = validateBody(GenerateOutlineSchema, event.body ?? null);

  // Invoke slide-generator Lambda for outline generation
  const payload = {
    action: "generateOutline",
    projectId,
    userId,
    topic: body.topic,
    sourceText: body.sourceText,
    referenceUrls: body.referenceUrls,
    audience: body.audience,
    pages: body.pages,
    tone: body.tone,
    theme: body.theme,
    contentLanguage: body.contentLanguage,
  };

  const response = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: SLIDE_GENERATOR_ARN,
      Payload: Buffer.from(JSON.stringify(payload)),
    }),
  );

  if (response.FunctionError) {
    const errorPayload = response.Payload
      ? JSON.parse(Buffer.from(response.Payload).toString())
      : { errorMessage: "Unknown error" };
    throw new ApiError(
      502,
      `Outline generation failed: ${errorPayload.errorMessage ?? "Unknown"}`,
      "GENERATION_FAILED",
    );
  }

  const result = response.Payload
    ? JSON.parse(Buffer.from(response.Payload).toString())
    : {};

  // Store the generated outline in the project record
  await updateProject(userId, projectId, {
    outline: result.outline,
    status: "OUTLINE_GENERATED",
  });

  return buildResponse(200, {
    outline: result.outline,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });
}

export async function handleSaveOutline(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = requireAuth(event);
  const projectId = event.pathParameters?.id;
  if (!projectId) {
    throw new ApiError(400, "Missing project ID", "BAD_REQUEST");
  }

  await verifyProjectOwnership(projectId, userId);
  const body = validateBody(SaveOutlineSchema, event.body ?? null);

  await updateProject(userId, projectId, {
    outline: body.outline,
    status: "OUTLINE_CONFIRMED",
  });

  return buildResponse(200, { outline: body.outline });
}
