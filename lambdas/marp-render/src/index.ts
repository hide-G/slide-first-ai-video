/**
 * Marp レンダリング Lambda ハンドラー (Docker不要版)
 * @marp-team/marp-core + puppeteer-core + @sparticuz/chromium を使用して
 * Marp Markdown を PDF/PPTX/PNG に変換し、S3 にアップロードする。
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  generatePdfBuffer,
  generatePptxBuffer,
  generatePngBuffers,
} from "./marp-commands.js";

/** サポートする出力形式 */
export type MarpOutputFormat = "pdf" | "pptx" | "png";

/** Marp レンダリング Lambda の入力イベント */
export interface MarpRenderEvent {
  projectId: string;
  userId: string;
  version: number;
  deckMarkdown: string;
  s3Bucket: string;
  s3Prefix: string;
  outputs: MarpOutputFormat[];
}

/** Marp レンダリング Lambda の出力 */
export interface MarpRenderResult {
  pdfKey?: string;
  pptxKey?: string;
  slideImageKeys: string[];
}

const s3Client = new S3Client({});

/**
 * Lambda ハンドラー
 */
export const handler = async (event: MarpRenderEvent): Promise<MarpRenderResult> => {
  const { deckMarkdown, s3Bucket, s3Prefix, outputs } = event;

  const result: MarpRenderResult = {
    slideImageKeys: [],
  };

  // 各形式を生成してアップロード
  for (const format of outputs) {
    switch (format) {
      case "pdf": {
        const pdfBuffer = await generatePdfBuffer(deckMarkdown);
        const pdfKey = `${s3Prefix}deck.pdf`;
        await s3Client.send(
          new PutObjectCommand({
            Bucket: s3Bucket,
            Key: pdfKey,
            Body: pdfBuffer,
            ContentType: "application/pdf",
          }),
        );
        result.pdfKey = pdfKey;
        break;
      }

      case "pptx": {
        const pptxBuffer = await generatePptxBuffer(deckMarkdown);
        const pptxKey = `${s3Prefix}deck.pptx`;
        await s3Client.send(
          new PutObjectCommand({
            Bucket: s3Bucket,
            Key: pptxKey,
            Body: pptxBuffer,
            ContentType:
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          }),
        );
        result.pptxKey = pptxKey;
        break;
      }

      case "png": {
        const pngBuffers = await generatePngBuffers(deckMarkdown);

        for (let i = 0; i < pngBuffers.length; i++) {
          const slideNumber = String(i + 1).padStart(3, "0");
          const pngKey = `${s3Prefix}slides/deck.${slideNumber}.png`;
          await s3Client.send(
            new PutObjectCommand({
              Bucket: s3Bucket,
              Key: pngKey,
              Body: pngBuffers[i],
              ContentType: "image/png",
            }),
          );
          result.slideImageKeys.push(pngKey);
        }
        break;
      }
    }
  }

  return result;
};
