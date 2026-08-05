/**
 * Marp rendering Lambda handler.
 * Converts Marp Markdown to PDF, PPTX, and/or PNG slide images.
 *
 * This Lambda runs as a container image with Marp CLI and Chromium pre-installed.
 * It writes the deck markdown to /tmp, executes marp CLI commands for each
 * requested output format, and uploads results to S3.
 */

import { writeFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { generatePdf, generatePptx, generatePng } from "./marp-commands.js";

/** Supported output formats */
export type MarpOutputFormat = "pdf" | "pptx" | "png";

/** Input event for the Marp render Lambda */
export interface MarpRenderEvent {
  projectId: string;
  userId: string;
  version: number;
  deckMarkdown: string;
  s3Bucket: string;
  s3Prefix: string;
  outputs: MarpOutputFormat[];
}

/** Output from the Marp render Lambda */
export interface MarpRenderResult {
  pdfKey?: string;
  pptxKey?: string;
  slideImageKeys: string[];
}

const s3Client = new S3Client({});
const WORK_DIR = "/tmp/marp-work";
const DECK_FILE = "deck.md";

/**
 * Lambda handler for Marp rendering.
 */
export const handler = async (event: MarpRenderEvent): Promise<MarpRenderResult> => {
  const { deckMarkdown, s3Bucket, s3Prefix, outputs } = event;

  // Ensure work directory exists
  const { mkdir } = await import("node:fs/promises");
  await mkdir(WORK_DIR, { recursive: true });

  // Write deck markdown to /tmp
  const deckPath = join(WORK_DIR, DECK_FILE);
  await writeFile(deckPath, deckMarkdown, "utf-8");

  const result: MarpRenderResult = {
    slideImageKeys: [],
  };

  // Generate requested outputs
  for (const format of outputs) {
    switch (format) {
      case "pdf": {
        await generatePdf(DECK_FILE, WORK_DIR);
        const pdfPath = join(WORK_DIR, "deck.pdf");
        const pdfBuffer = await readFile(pdfPath);
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
        await generatePptx(DECK_FILE, WORK_DIR);
        const pptxPath = join(WORK_DIR, "deck.pptx");
        const pptxBuffer = await readFile(pptxPath);
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
        await generatePng(DECK_FILE, WORK_DIR);
        // Read generated PNG files (deck.001.png, deck.002.png, etc.)
        const files = await readdir(WORK_DIR);
        const pngFiles = files
          .filter((f) => f.startsWith("deck.") && f.endsWith(".png"))
          .sort();

        for (const pngFile of pngFiles) {
          const pngPath = join(WORK_DIR, pngFile);
          const pngBuffer = await readFile(pngPath);
          const pngKey = `${s3Prefix}slides/${pngFile}`;
          await s3Client.send(
            new PutObjectCommand({
              Bucket: s3Bucket,
              Key: pngKey,
              Body: pngBuffer,
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
