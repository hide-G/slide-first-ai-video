/**
 * Stage 5: Concat - final video assembly Lambda handler.
 *
 * Concatenates all per-page clips into the final video.
 * Optionally burns subtitles using the SRT file via subtitles filter (NEVER drawtext, rule 3.5).
 *
 * Process:
 * 1. Download all clips + optionally captions SRT from S3
 * 2. Write concat list file
 * 3. If captions='burn': ffmpeg with -vf "subtitles=captions.srt"
 *    If captions='srt' or 'none': ffmpeg with -c copy
 * 4. Validate total duration matches sum(audioDurationSec) within 0.2s
 * 5. Decode check: ffmpeg -v error -i output.mp4 -map 0 -f null -
 * 6. Upload to output/{renderId}/video.mp4
 *
 * Uses execFile with array args, NEVER shell (rule 3.5).
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Manifest } from "@slide-first/shared-types";
import { clipKey, captionsSrtKey, outputVideoKey } from "@slide-first/shared-types";
import { totalDurationSec } from "@slide-first/core";
import { buildConcatArgs, buildConcatListContent } from "@slide-first/renderer-ffmpeg";

const execFileAsync = promisify(execFile);
const s3Client = new S3Client({});

const DURATION_TOLERANCE_SEC = 0.2;

export interface ConcatEvent {
  bucket: string;
  manifestKey: string;
  renderId: string;
}

export interface ConcatResult {
  success: boolean;
  outputKey: string;
  totalDuration: number;
  error?: string;
}

/**
 * Lambda handler for Stage 5: Concat.
 */
export const handler = async (event: ConcatEvent): Promise<ConcatResult> => {
  const { bucket, manifestKey, renderId } = event;

  // 1. Read manifest
  const manifest = await readManifest(bucket, manifestKey);

  try {
    // 2. Update stage to running
    manifest.stages.concat = "running";
    await writeManifest(bucket, manifestKey, manifest);

    const keyParams = { userId: manifest.userId, projectId: manifest.projectId };
    const tmpDir = "/tmp/concat-work";
    await mkdir(tmpDir, { recursive: true });

    // 3. Download all clips
    const clipPaths: string[] = [];
    for (const page of manifest.pages) {
      const padded = String(page.pageNumber).padStart(3, "0");
      const localPath = join(tmpDir, `page-${padded}.mp4`);
      const s3Key = clipKey(keyParams, page.pageNumber);
      const buffer = await downloadObject(bucket, s3Key);
      await writeFile(localPath, buffer);
      clipPaths.push(localPath);
    }

    // 4. Write concat list file
    const listContent = buildConcatListContent(clipPaths);
    const listPath = join(tmpDir, "list.txt");
    await writeFile(listPath, listContent);

    // 5. Optionally download SRT
    let srtPath: string | undefined;
    if (manifest.output.captions === "burn") {
      const srtKey = captionsSrtKey(keyParams);
      const srtBuffer = await downloadObject(bucket, srtKey);
      srtPath = join(tmpDir, "captions.srt");
      await writeFile(srtPath, srtBuffer);
    }

    // 6. Build and execute concat command
    const outputPath = join(tmpDir, "video.mp4");
    const args = buildConcatArgs({
      concatListPath: listPath,
      outputPath,
      captionsMode: manifest.output.captions,
      srtPath,
    });
    await execFileAsync("ffmpeg", args);

    // 7. Validate total duration
    const expectedDuration = totalDurationSec(manifest.pages);
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      outputPath,
    ]);
    const actualDuration = parseFloat(stdout.trim());
    const drift = Math.abs(actualDuration - expectedDuration);
    if (drift > DURATION_TOLERANCE_SEC) {
      throw new Error(
        `Total duration drift too large: ${drift.toFixed(3)}s (max ${DURATION_TOLERANCE_SEC}s). ` +
        `Expected ${expectedDuration.toFixed(3)}s, got ${actualDuration.toFixed(3)}s`,
      );
    }

    // 8. Decode check
    await execFileAsync("ffmpeg", [
      "-v", "error",
      "-i", outputPath,
      "-map", "0",
      "-f", "null",
      "-",
    ]);

    // 9. Upload final video to S3
    const videoBuffer = await readFile(outputPath);
    const videoKey = outputVideoKey(keyParams, renderId);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: videoKey,
        Body: videoBuffer,
        ContentType: "video/mp4",
      }),
    );

    // 10. Update stage to done
    manifest.stages.concat = "done";
    await writeManifest(bucket, manifestKey, manifest);

    return { success: true, outputKey: videoKey, totalDuration: actualDuration };
  } catch (error: unknown) {
    manifest.stages.concat = "failed";
    await writeManifest(bucket, manifestKey, manifest);

    const message = error instanceof Error ? error.message : String(error);
    return { success: false, outputKey: "", totalDuration: 0, error: message };
  }
};

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
