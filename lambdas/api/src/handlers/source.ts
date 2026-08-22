/**
 * 素材APIハンドラー:
 *   POST /projects/{id}/source-upload-url - 署名付きアップロードURLを取得する
 *   POST /projects/{id}/source - アップロード済みPDFを登録し、ページ数をサーバー側で確定する
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  requireAuth,
  verifyProjectOwnership,
  validateBody,
  SourceUploadUrlSchema,
  RegisterSourceSchema,
  buildResponse,
  ApiError,
} from "../middleware/index.js";
import { updateProject } from "../db/index.js";

const s3Client = new S3Client({});
const lambdaClient = new LambdaClient({});
const BUCKET_NAME = process.env.BUCKET_NAME ?? "";
const MARP_LAMBDA_ARN = process.env.MARP_LAMBDA_ARN ?? "";

/** 許容するアップロードサイズ（100 MB） */
const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024;
/** 画面とパイプラインがサポートする最大ページ数 */
const MAX_PAGE_COUNT = 50;

/** 制御文字を除外し、表示・HTTPヘッダーへ安全に使える文字列へ変換する。 */
function removeControlCharacters(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && codePoint >= 0x20 && codePoint !== 0x7f;
    })
    .join("");
}

/** 表示・ダウンロード名に使うため、パスや制御文字を除去したファイル名を返す。 */
function sanitizeSourceFileName(fileName: string): string {
  const leafName = fileName.replace(/\\/g, "/").split("/").pop() ?? "";
  const normalized = removeControlCharacters(leafName.normalize("NFKC")).trim();
  const limited = Array.from(normalized).slice(0, 200).join("");
  return limited || "source.pdf";
}

function ensurePdfFileName(fileName: string): void {
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    throw new ApiError(
      400,
      "PDFファイルをアップロードしてください / Please upload a PDF file",
      "PDF_REQUIRED",
    );
  }
}

export async function handleSourceUploadUrl(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = requireAuth(event);
  const projectId = event.pathParameters?.id;
  if (!projectId) {
    throw new ApiError(400, "Missing project ID", "BAD_REQUEST");
  }

  await verifyProjectOwnership(projectId, userId);
  const body = validateBody(SourceUploadUrlSchema, event.body ?? null);
  const fileName = sanitizeSourceFileName(body.fileName);
  ensurePdfFileName(fileName);

  // S3キーは利用者入力の名前に依存させず、固定の安全なキーを使う。
  const fileKey = `users/${userId}/projects/${projectId}/input/source.pdf`;
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
    ContentType: "application/pdf",
  });
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  return buildResponse(200, {
    uploadUrl,
    fileKey,
    maxSizeBytes: MAX_UPLOAD_SIZE_BYTES,
  });
}

export async function handleRegisterSource(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = requireAuth(event);
  const projectId = event.pathParameters?.id;
  if (!projectId) {
    throw new ApiError(400, "Missing project ID", "BAD_REQUEST");
  }

  await verifyProjectOwnership(projectId, userId);
  const body = validateBody(RegisterSourceSchema, event.body ?? null);
  const expectedPrefix = `users/${userId}/projects/${projectId}/`;
  if (!body.fileKey.startsWith(expectedPrefix)) {
    throw new ApiError(400, "Invalid source file key", "INVALID_SOURCE_KEY");
  }

  const ext = body.fileKey.split(".").pop()?.toLowerCase();
  if (ext !== "pdf") {
    throw new ApiError(
      400,
      "PDFファイルを登録してください / Please register a PDF file",
      "PDF_REQUIRED",
    );
  }

  const sourceFileName = body.fileName ? sanitizeSourceFileName(body.fileName) : undefined;
  if (sourceFileName) {
    ensurePdfFileName(sourceFileName);
  }

  const headResult = await s3Client.send(
    new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: body.fileKey,
    }),
  );
  const objectSize = headResult.ContentLength ?? 0;
  if (objectSize > MAX_UPLOAD_SIZE_BYTES) {
    throw new ApiError(
      400,
      `Uploaded file exceeds maximum size of ${MAX_UPLOAD_SIZE_BYTES} bytes (actual: ${objectSize})`,
      "FILE_TOO_LARGE",
    );
  }
  if (objectSize === 0) {
    throw new ApiError(400, "Uploaded file is empty", "EMPTY_FILE");
  }

  const pageCount = await inspectPdfPageCount({
    userId,
    projectId,
    fileKey: body.fileKey,
  });
  if (pageCount > MAX_PAGE_COUNT) {
    throw new ApiError(
      400,
      `Uploaded PDF exceeds maximum page count of ${MAX_PAGE_COUNT} (actual: ${pageCount})`,
      "TOO_MANY_PAGES",
    );
  }

  const source = {
    kind: body.kind,
    fileKey: body.fileKey,
    pageCount,
    ...(sourceFileName ? { fileName: sourceFileName } : {}),
  };
  await updateProject(userId, projectId, {
    source,
    status: "SOURCE_REGISTERED",
  });

  return buildResponse(200, { source });
}

async function inspectPdfPageCount(input: {
  userId: string;
  projectId: string;
  fileKey: string;
}): Promise<number> {
  const response = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: MARP_LAMBDA_ARN,
      InvocationType: "RequestResponse",
      Payload: Buffer.from(
        JSON.stringify({
          action: "inspectSource",
          s3Bucket: BUCKET_NAME,
          userId: input.userId,
          projectId: input.projectId,
          sourceKey: input.fileKey,
        }),
      ),
    }),
  );

  if (response.FunctionError) {
    throw new ApiError(502, "PDFページ数の取得に失敗しました", "SOURCE_INSPECTION_FAILED");
  }

  const payloadText = response.Payload ? Buffer.from(response.Payload).toString("utf-8") : "{}";
  let result: { success?: unknown; pageCount?: unknown };
  try {
    result = JSON.parse(payloadText) as { success?: unknown; pageCount?: unknown };
  } catch {
    throw new ApiError(502, "PDFページ数の応答を解釈できませんでした", "SOURCE_INSPECTION_FAILED");
  }

  const pageCount = Number(result.pageCount);
  if (result.success !== true || !Number.isInteger(pageCount) || pageCount < 1) {
    throw new ApiError(422, "PDFのページ数を取得できませんでした", "SOURCE_INSPECTION_FAILED");
  }

  return pageCount;
}
