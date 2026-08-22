/**
 * ナレーション API ハンドラー:
 *   POST /projects/{id}/narration - 指定ページの原稿案を生成する
 *   PUT  /projects/{id}/narration - 確定した原稿と辞書を保存する
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { z } from "zod";
import {
  requireAuth,
  verifyProjectOwnership,
  validateBody,
  GenerateNarrationSchema,
  SaveNarrationSchema,
  buildResponse,
  ApiError,
} from "../middleware/index.js";
import { updateProject } from "../db/index.js";

const lambdaClient = new LambdaClient({});
const SLIDE_GENERATOR_ARN = process.env.SLIDE_GENERATOR_ARN ?? "";

const GeneratedNarrationResultSchema = z.object({
  script: z.object({
    pageNumber: z.number().int().positive(),
    mode: z.enum(["plain", "ssml"]),
    text: z.string().trim().min(1),
  }),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
});

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readInvokePayload(payload: Uint8Array | undefined): unknown {
  if (!payload) return {};

  try {
    return JSON.parse(Buffer.from(payload).toString("utf-8"));
  } catch {
    return {};
  }
}

function errorMessageFromPayload(payload: unknown): string {
  const result = asRecord(payload);
  return typeof result.errorMessage === "string" ? result.errorMessage : "不明なエラー";
}

export async function handleGenerateNarration(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = requireAuth(event);
  const projectId = event.pathParameters?.id;
  if (!projectId) {
    throw new ApiError(400, "プロジェクトIDがありません。", "BAD_REQUEST");
  }

  const project = await verifyProjectOwnership(projectId, userId);
  const body = validateBody(GenerateNarrationSchema, event.body ?? null);

  const source = asRecord(project.source);
  if (
    (source.kind !== "generated" && source.kind !== "uploaded") ||
    typeof source.fileKey !== "string" ||
    source.fileKey.length === 0 ||
    typeof source.pageCount !== "number" ||
    !Number.isInteger(source.pageCount) ||
    source.pageCount < 1
  ) {
    throw new ApiError(
      400,
      "AIナレーション案を作成する前にPDFをアップロードしてください。",
      "SOURCE_REQUIRED",
    );
  }

  if (body.pageNumber > source.pageCount) {
    throw new ApiError(400, `${body.pageNumber}ページ目はPDFの範囲外です。`, "PAGE_OUT_OF_RANGE");
  }

  if (!SLIDE_GENERATOR_ARN) {
    throw new ApiError(
      500,
      "AIナレーション生成Lambdaが設定されていません。",
      "CONFIGURATION_ERROR",
    );
  }

  const response = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: SLIDE_GENERATOR_ARN,
      Payload: Buffer.from(
        JSON.stringify({
          action: "generateNarration",
          projectId,
          userId,
          pageNumber: body.pageNumber,
          pageText: body.pageText,
          contentLanguage: project.contentLanguage ?? "ja-JP",
        }),
      ),
    }),
  );

  const result = readInvokePayload(response.Payload);
  if (response.FunctionError) {
    throw new ApiError(
      502,
      `AIナレーション案の生成に失敗しました: ${errorMessageFromPayload(result)}`,
      "GENERATION_FAILED",
    );
  }

  const parsedResult = GeneratedNarrationResultSchema.safeParse(result);
  if (!parsedResult.success || parsedResult.data.script.pageNumber !== body.pageNumber) {
    throw new ApiError(
      502,
      "AIナレーション生成Lambdaから無効な応答を受信しました。",
      "GENERATION_FAILED",
    );
  }

  return buildResponse(200, parsedResult.data);
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
