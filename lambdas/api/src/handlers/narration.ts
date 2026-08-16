/**
 * Narration API handlers:
 *   POST /projects/{id}/narration - Generate narration drafts via Bedrock
 *   PUT  /projects/{id}/narration - Save confirmed narration + lexicon
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import {
  requireAuth,
  verifyProjectOwnership,
  validateBody,
  GenerateNarrationSchema,
  SaveNarrationSchema,
  buildResponse,
  ApiError,
} from "../middleware/index.js";
import { getProject, updateProject } from "../db/index.js";

const lambdaClient = new LambdaClient({});
const SLIDE_GENERATOR_ARN = process.env.SLIDE_GENERATOR_ARN ?? "";

export async function handleGenerateNarration(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = requireAuth(event);
  const projectId = event.pathParameters?.id;
  if (!projectId) {
    throw new ApiError(400, "Missing project ID", "BAD_REQUEST");
  }

  await verifyProjectOwnership(projectId, userId);
  const body = validateBody(GenerateNarrationSchema, event.body ?? null);

  // Get project to access outline
  const project = await getProject(projectId);
  if (!project || !project.outline) {
    throw new ApiError(400, "Project outline is required for narration generation", "OUTLINE_REQUIRED");
  }

  // Invoke slide-generator Lambda for narration generation
  const payload = {
    action: "generateNarration",
    projectId,
    userId,
    outline: project.outline,
    voiceId: body.voiceId,
    engine: body.engine,
    languageCode: body.languageCode,
    contentLanguage: project.contentLanguage,
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
      `Narration generation failed: ${errorPayload.errorMessage ?? "Unknown"}`,
      "GENERATION_FAILED",
    );
  }

  const result = response.Payload
    ? JSON.parse(Buffer.from(response.Payload).toString())
    : {};

  return buildResponse(200, {
    scripts: result.scripts,
    lexicon: result.lexicon,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });
}

export async function handleSaveNarration(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = requireAuth(event);
  const projectId = event.pathParameters?.id;
  if (!projectId) {
    throw new ApiError(400, "Missing project ID", "BAD_REQUEST");
  }

  await verifyProjectOwnership(projectId, userId);
  const body = validateBody(SaveNarrationSchema, event.body ?? null);

  await updateProject(userId, projectId, {
    narration: body.scripts,
    lexicon: body.lexicon ?? [],
    voice: body.voice,
    status: "NARRATION_CONFIRMED",
  });

  return buildResponse(200, {
    scripts: body.scripts,
    lexicon: body.lexicon ?? [],
  });
}
