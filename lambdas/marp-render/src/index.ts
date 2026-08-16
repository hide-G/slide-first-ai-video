/**
 * Stage 1: Pages - PDF/PPTX to PNG rasterization Lambda handler.
 *
 * Reads manifest.json from S3, converts PDF source to PNG page images
 * using pdftoppm, uploads PNGs, and updates manifest.stages.pages to 'done'.
 *
 * For Marp-generated decks: deck/deck.pdf is the source.
 * For uploaded PDFs: input/source.pdf is the source.
 * For PPTX: convert to PDF first via LibreOffice, then use pdftoppm.
 *
 * Uses execFile with array args (NEVER shell).
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { Manifest } from "@slide-first/shared-types";
import { pageImageKey } from "@slide-first/shared-types";

const execFileAsync = promisify(execFile);
const s3Client = new S3Client({});

export interface PagesEvent {
  bucket: string;
  manifestKey: string;
}

export interface PagesResult {
  success: boolean;
  pageCount: number;
  error?: string;
}

/**
 * Lambda handler for Stage 1: Pages.
 */
export const handler = async (event: PagesEvent): Promise<PagesResult> => {
  const { bucket, manifestKey } = event;

  // 1. Read manifest
  const manifest = await readManifest(bucket, manifestKey);

  try {
    // 2. Update stage to running
    manifest.stages.pages = "running";
    await writeManifest(bucket, manifestKey, manifest);

    // 3. Download the source PDF
    const sourceKey = resolveSourceKey(manifest);
    const pdfBuffer = await downloadObject(bucket, sourceKey);

    // 4. Write PDF to /tmp
    const tmpDir = "/tmp/pages-work";
    await mkdir(tmpDir, { recursive: true });
    const pdfPath = join(tmpDir, "source.pdf");
    await writeFile(pdfPath, pdfBuffer);

    // 5. If source is PPTX, convert to PDF first
    const ext = sourceKey.split(".").pop();
    let actualPdfPath = pdfPath;
    if (ext === "pptx") {
      await execFileAsync("libreoffice", [
        "--headless",
        "--convert-to", "pdf",
        "--outdir", tmpDir,
        pdfPath,
      ]);
      actualPdfPath = join(tmpDir, "source.pdf");
    }

    // 6. Convert PDF to PNGs using pdftoppm
    const outputPrefix = join(tmpDir, "page");
    await execFileAsync("pdftoppm", [
      "-png",
      "-r", "300",
      actualPdfPath,
      outputPrefix,
    ]);

    // 7. Read generated PNGs and upload to S3
    const files = await readdir(tmpDir);
    const pngFiles = files.filter((f) => f.endsWith(".png")).sort();

    if (pngFiles.length !== manifest.source.pageCount) {
      throw new Error(
        `PNG count mismatch: generated ${pngFiles.length}, expected ${manifest.source.pageCount}`,
      );
    }

    const keyParams = { userId: manifest.userId, projectId: manifest.projectId };

    for (let i = 0; i < pngFiles.length; i++) {
      const pageNumber = i + 1;
      const pngBuffer = await readFile(join(tmpDir, pngFiles[i]));
      const s3Key = pageImageKey(keyParams, pageNumber);
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          Body: pngBuffer,
          ContentType: "image/png",
        }),
      );
    }

    // 8. Update manifest stage to done
    manifest.stages.pages = "done";
    await writeManifest(bucket, manifestKey, manifest);

    return { success: true, pageCount: pngFiles.length };
  } catch (error: unknown) {
    // Mark stage as failed
    manifest.stages.pages = "failed";
    await writeManifest(bucket, manifestKey, manifest);

    const message = error instanceof Error ? error.message : String(error);
    return { success: false, pageCount: 0, error: message };
  }
};

/**
 * Determine the source PDF key from the manifest.
 */
function resolveSourceKey(manifest: Manifest): string {
  const keyParams = { userId: manifest.userId, projectId: manifest.projectId };
  const prefix = `users/${keyParams.userId}/projects/${keyParams.projectId}`;

  if (manifest.source.kind === "generated") {
    // Marp-generated deck
    return `${prefix}/deck/deck.pdf`;
  }

  // Uploaded source file
  return manifest.source.fileKey;
}

async function readManifest(bucket: string, key: string): Promise<Manifest> {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const body = await response.Body!.transformToString();
  return JSON.parse(body) as Manifest;
}

async function writeManifest(bucket: string, key: string, manifest: Manifest): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(manifest, null, 2),
      ContentType: "application/json",
    }),
  );
}

async function downloadObject(bucket: string, key: string): Promise<Buffer> {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const bytes = await response.Body!.transformToByteArray();
  return Buffer.from(bytes);
}
