/**
 * Stage 4: Clips - per-page video generation Lambda handler.
 *
 * For each page, creates an MP4 video clip combining:
 * - pages/page-NNN.png (still image, looped)
 * - audio/page-NNN.mp3 (speech audio)
 * - audioDurationSec (explicit -t parameter, rule 7.1)
 *
 * Uses execFile with array args, NEVER shell (rule 3.5).
 * Never embeds text in FFmpeg commands (rule 3.5).
 *
 * Validation: clip duration matches audioDurationSec within 0.05s tolerance.
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Manifest } from "@slide-first/shared-types";
import { clipKey } from "@slide-first/shared-types";
import { buildClipArgs } from "@slide-first/renderer-ffmpeg";

const execFileAsync = promisify(execFile);
const s3Client = new S3Client({});

const DURATION_TOLERANCE_SEC = 0.05;

export interface ClipsEvent {
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

export interface ClipsResult {
  success: boolean;
  clipCount: number;
  error?: string;
}

/**
 * Lambda handler for Stage 4: Clips.
 */
export const handler = async (event: ClipsEvent): Promise<ClipsResult> => {
  const bucket = event.s3Bucket;
  const manifestKey = `${event.s3Prefix}manifest.json`;

  // 1. Read manifest
  const manifest = await readManifest(bucket, manifestKey);

  try {
    // 2. Update stage to running
    manifest.stages.clips = "running";
    await writeManifest(bucket, manifestKey, manifest);

    const keyParams = { userId: manifest.userId, projectId: manifest.projectId };
    const tmpDir = "/tmp/clips-work";
    await mkdir(tmpDir, { recursive: true });

    const { width, height, fps } = manifest.output;

    // 3. Process each page
    for (const page of manifest.pages) {
      if (page.audioDurationSec <= 0) {
        throw new Error(
          `Page ${page.pageNumber} has no measured audioDurationSec. Audio stage must complete first.`,
        );
      }

      const padded = String(page.pageNumber).padStart(3, "0");
      const imagePath = join(tmpDir, `page-${padded}.png`);
      const audioPath = join(tmpDir, `page-${padded}.mp3`);
      const clipPath = join(tmpDir, `page-${padded}.mp4`);

      // Download PNG and MP3 from S3
      const imageBuffer = await downloadObject(bucket, page.imageKey);
      const audioBuffer = await downloadObject(bucket, page.audioKey);
      await writeFile(imagePath, imageBuffer);
      await writeFile(audioPath, audioBuffer);

      // Build and execute FFmpeg command
      const args = buildClipArgs({
        imagePath,
        audioPath,
        audioDurationSec: page.audioDurationSec,
        outputPath: clipPath,
        width,
        height,
        fps,
      });

      await execFileAsync("ffmpeg", args);

      // Validate clip duration
      const { stdout } = await execFileAsync("ffprobe", [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "csv=p=0",
        clipPath,
      ]);
      const clipDuration = parseFloat(stdout.trim());
      const drift = Math.abs(clipDuration - page.audioDurationSec);
      if (drift > DURATION_TOLERANCE_SEC) {
        throw new Error(
          `Clip ${padded} duration drift too large: ${drift.toFixed(3)}s (max ${DURATION_TOLERANCE_SEC}s)`,
        );
      }

      // Upload clip to S3
      const clipBuffer = await readFile(clipPath);
      const s3Key = clipKey(keyParams, page.pageNumber);
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          Body: clipBuffer,
          ContentType: "video/mp4",
        }),
      );
    }

    // 4. Update stage to done
    manifest.stages.clips = "done";
    await writeManifest(bucket, manifestKey, manifest);

    return { success: true, clipCount: manifest.pages.length };
  } catch (error: unknown) {
    manifest.stages.clips = "failed";
    await writeManifest(bucket, manifestKey, manifest);

    const message = error instanceof Error ? error.message : String(error);
    return { success: false, clipCount: 0, error: message };
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
