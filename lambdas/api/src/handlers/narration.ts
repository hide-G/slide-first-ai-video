/**
 * ナレーション API ハンドラー:
 *   POST /projects/{id}/narration - 指定ページの原稿案を生成する
 *   PUT  /projects/{id}/narration - 確定した原稿と辞書を保存する
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import {
  extractAudibleNarrationText,
  hasUnsupportedNarrationSsmlDeclaration,
  isNarrationLanguageSetting,
  isNarrationTextInLanguage,
  resolveNarrationLanguage,
  type NarrationLanguageCode,
  type NarrationLanguageSetting,
} from "@slide-first/core";
import { isSupportedNarrationVoice } from "@slide-first/shared-types";
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
    languageCode: z.enum(["ja-JP", "en-US"]),
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

function errorCodeFromPayload(payload: unknown): string | undefined {
  const result = asRecord(payload);
  return typeof result.errorType === "string" ? result.errorType : undefined;
}

function resolveProjectNarrationLanguage(value: unknown): NarrationLanguageSetting {
  return isNarrationLanguageSetting(value) ? value : "auto";
}

function narrationLanguageUndeterminedError(pageNumber: number): ApiError {
  return new ApiError(
    400,
    `${pageNumber}ページ目の言語を自動判定できません。プロジェクトまたはページ単位で日本語・英語を選択してください。`,
    "NARRATION_LANGUAGE_UNDETERMINED",
  );
}

function narrationLanguageMismatchError(
  pageNumber: number,
  languageCode: NarrationLanguageCode,
): ApiError {
  return new ApiError(
    400,
    `${pageNumber}ページ目の原稿が指定言語 (${languageCode}) と一致しません。原稿本文またはページ単位の言語設定を確認してください。`,
    "NARRATION_LANGUAGE_MISMATCH",
  );
}

function unsupportedNarrationSsmlDeclarationError(pageNumber: number): ApiError {
  return new ApiError(
    400,
    `${pageNumber}ページ目のSSMLにはCDATA、DOCTYPE、ENTITY宣言を使用できません。読み上げ本文へ直接記述してください。`,
    "NARRATION_SSML_UNSUPPORTED",
  );
}

function hasVoiceForLanguage(
  languageCode: NarrationLanguageCode,
  voiceProfiles: unknown,
  legacyVoice: unknown,
): boolean {
  const profiles = asRecord(voiceProfiles);
  const profile = asRecord(profiles[languageCode]);
  if (Object.keys(profile).length > 0) {
    return isSupportedNarrationVoice(profile, languageCode);
  }

  const voice = asRecord(legacyVoice);
  if (Object.keys(voice).length > 0) {
    return isSupportedNarrationVoice(voice, languageCode);
  }

  // 音声設定が一切ない旧プロジェクトは、従来どおり日本語の既定音声で再生できる。
  return languageCode === "ja-JP";
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

  const narrationLanguage =
    body.narrationLanguage ?? resolveProjectNarrationLanguage(project.narrationLanguage);
  const languageCode = resolveNarrationLanguage(
    narrationLanguage,
    body.pageText,
    body.languageOverride,
  );
  if (!languageCode) {
    throw narrationLanguageUndeterminedError(body.pageNumber);
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
          languageCode,
        }),
      ),
    }),
  );

  const result = readInvokePayload(response.Payload);
  if (response.FunctionError) {
    if (errorCodeFromPayload(result) === "NARRATION_LANGUAGE_MISMATCH") {
      throw new ApiError(
        422,
        "AIが指定した言語のナレーション原稿を生成できませんでした。言語設定を確認して再試行してください。",
        "NARRATION_LANGUAGE_MISMATCH",
      );
    }
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

  if (parsedResult.data.script.languageCode !== languageCode) {
    throw new ApiError(
      502,
      "AIナレーション生成Lambdaが指定と異なる言語の原稿を返しました。",
      "NARRATION_LANGUAGE_MISMATCH",
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
    throw new ApiError(400, "プロジェクトIDがありません。", "BAD_REQUEST");
  }

  const project = await verifyProjectOwnership(projectId, userId);
  const body = validateBody(SaveNarrationSchema, event.body ?? null);
  const narrationLanguage =
    body.narrationLanguage ?? resolveProjectNarrationLanguage(project.narrationLanguage);
  const lexicon = body.lexicon ?? [];

  const scripts = body.scripts.map((script) => {
    if (hasUnsupportedNarrationSsmlDeclaration(script)) {
      throw unsupportedNarrationSsmlDeclarationError(script.pageNumber);
    }

    // Auto判定と保存検証は、辞書展開後にPollyが実際に読む同じ本文を正本にする。
    const audibleText = extractAudibleNarrationText(script, lexicon);
    const languageCode = resolveNarrationLanguage(
      narrationLanguage,
      audibleText ?? "",
      script.languageOverride,
    );
    if (!languageCode) {
      throw narrationLanguageUndeterminedError(script.pageNumber);
    }

    if (
      !audibleText ||
      !isNarrationTextInLanguage(audibleText, languageCode, { allowLiteralMarkup: true })
    ) {
      throw narrationLanguageMismatchError(script.pageNumber, languageCode);
    }

    return { ...script, languageCode };
  });

  const voiceProfiles = body.voiceProfiles ?? project.voiceProfiles;
  const voice = body.voice ?? project.voice;
  if (body.voice && !isSupportedNarrationVoice(body.voice)) {
    throw new ApiError(
      400,
      "指定されたグローバル音声のVoiceIdまたはエンジンはサポートされていません。",
      "VOICE_PROFILE_INVALID",
    );
  }

  const missingVoiceLanguage = [...new Set(scripts.map((script) => script.languageCode))].find(
    (languageCode) => !hasVoiceForLanguage(languageCode, voiceProfiles, voice),
  );
  if (missingVoiceLanguage) {
    throw new ApiError(
      400,
      `${missingVoiceLanguage} のナレーション用音声が設定されていません。言語別の音声を選択してください。`,
      "VOICE_PROFILE_REQUIRED",
    );
  }

  await updateProject(userId, projectId, {
    narration: scripts,
    lexicon,
    voice: body.voice,
    voiceProfiles: body.voiceProfiles,
    narrationLanguage,
    status: "NARRATION_CONFIRMED",
  });

  return buildResponse(200, {
    scripts,
    lexicon,
    narrationLanguage,
  });
}
