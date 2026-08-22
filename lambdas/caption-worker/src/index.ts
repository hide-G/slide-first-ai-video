/**
 * Stage 3: Captions - SRT generation Lambda handler.
 *
 * Reads manifest with confirmed scripts and measured audioDurationSec,
 * generates SRT captions using cumulative timing, and uploads to S3.
 *
 * Validation:
 * - subtitle count === page count (pages with non-empty text)
 * - timestamps monotonically increasing
 * - all audioDurationSec must be measured (> 0)
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { Manifest } from "@slide-first/shared-types";
import { captionsSrtKey } from "@slide-first/shared-types";
import { generateSrt, totalDurationSec } from "@slide-first/core";

const s3Client = new S3Client({});

export interface CaptionsEvent {
  /** S3 bucket name (from state machine payload) */
  s3Bucket: string;
  /** S3 prefix e.g. "users/{userId}/projects/{projectId}/" (from state machine payload) */
  s3Prefix: string;
  /** Project ID */
  projectId: string;
  /** User ID */
  userId: string;
  /** Render ID */
  renderId: string;
  /** Stage name */
  stage?: string;
}

export interface CaptionsResult {
  success: boolean;
  subtitleCount: number;
  totalDuration: number;
  error?: string;
}

/**
 * Lambda handler for Stage 3: Captions.
 */
export const handler = async (event: CaptionsEvent): Promise<CaptionsResult> => {
  const bucket = event.s3Bucket;
  const manifestKey = `${event.s3Prefix}manifest.json`;

  // 1. Read manifest
  const manifest = await readManifest(bucket, manifestKey);

  try {
    // 2. Update stage to running
    manifest.stages.captions = "running";
    updateCaptionProgress(manifest, 0, manifest.pages.length, "字幕を生成しています。");
    await writeManifest(bucket, manifestKey, manifest);

    // 無音動画と字幕なし設定ではSRTを作らない。MediaConvertは無音WAVだけを使う。
    if (manifest.output.narrationMode === "none" || manifest.output.captions === "none") {
      const total = totalDurationSec(manifest.pages);
      manifest.stages.captions = "done";
      updateCaptionProgress(
        manifest,
        manifest.pages.length,
        manifest.pages.length,
        "字幕なしの設定のため、SRTは生成しませんでした。",
      );
      await writeManifest(bucket, manifestKey, manifest);
      return { success: true, subtitleCount: 0, totalDuration: total };
    }

    // 3. Validate all audioDurationSec are measured
    for (const page of manifest.pages) {
      if (page.audioDurationSec <= 0) {
        throw new Error(
          `Page ${page.pageNumber} has no measured audioDurationSec. Audio stage must complete first.`,
        );
      }
    }

    // 4. Generate SRT content
    const srtContent = generateSrt(manifest.pages);

    // 5. Validate subtitle count
    const subtitleCount = srtContent
      .split(/\n\n/)
      .filter((block) => block.trim().length > 0).length;
    const nonEmptyPages = manifest.pages.filter((p) => p.script.text.trim().length > 0).length;
    if (subtitleCount !== nonEmptyPages) {
      throw new Error(
        `Subtitle count mismatch: generated ${subtitleCount}, expected ${nonEmptyPages}`,
      );
    }

    // 6. Upload SRT to S3
    const keyParams = { userId: manifest.userId, projectId: manifest.projectId };
    const srtKey = captionsSrtKey(keyParams);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: srtKey,
        Body: srtContent,
        ContentType: "text/plain; charset=utf-8",
      }),
    );

    // 7. Calculate total duration for result
    const total = totalDurationSec(manifest.pages);

    // 8. Update stage to done
    manifest.stages.captions = "done";
    updateCaptionProgress(
      manifest,
      manifest.pages.length,
      manifest.pages.length,
      `${subtitleCount}件の字幕を生成しました。`,
    );
    await writeManifest(bucket, manifestKey, manifest);

    return { success: true, subtitleCount, totalDuration: total };
  } catch (error: unknown) {
    manifest.stages.captions = "failed";
    updateCaptionProgress(
      manifest,
      manifest.progress?.currentPage ?? 0,
      manifest.pages.length,
      "字幕の生成に失敗しました。",
    );
    await writeManifest(bucket, manifestKey, manifest);

    const message = error instanceof Error ? error.message : String(error);
    return { success: false, subtitleCount: 0, totalDuration: 0, error: message };
  }
};

function updateCaptionProgress(
  manifest: Manifest,
  currentPage: number,
  totalPages: number,
  message: string,
): void {
  manifest.progress = {
    stage: "captions",
    currentPage,
    totalPages: Math.max(1, totalPages),
    message,
    updatedAt: new Date().toISOString(),
  };
}

async function readManifest(bucket: string, key: string): Promise<Manifest> {
  const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
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
