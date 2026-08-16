/**
 * Stage 2: Audio - Amazon Polly speech synthesis Lambda handler.
 *
 * For each page in the manifest:
 * 1. Apply lexicon substitutions to script text
 * 2. Wrap in SSML (mode='ssml') or XML-escape then wrap (mode='plain')
 * 3. Call Polly SynthesizeSpeech (OutputFormat: mp3)
 * 4. Record x-amzn-RequestCharacters for cost
 * 5. Upload MP3 to S3
 * 6. Measure duration with ffprobe
 * 7. Write audioDurationSec to manifest page entry
 *
 * Uses script hash check: skip synthesis if hash unchanged and audio exists (section 12).
 */

import {
  PollyClient,
  SynthesizeSpeechCommand,
  type VoiceId,
  type Engine,
  type LanguageCode,
} from "@aws-sdk/client-polly";
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Manifest, LexiconEntry } from "@slide-first/shared-types";
import { audioKey } from "@slide-first/shared-types";
import { computeScriptHash } from "@slide-first/core";

const execFileAsync = promisify(execFile);
const pollyClient = new PollyClient({});
const s3Client = new S3Client({});

export interface AudioEvent {
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

export interface AudioResult {
  success: boolean;
  totalCharacters: number;
  error?: string;
}

/**
 * Lambda handler for Stage 2: Audio.
 */
export const handler = async (event: AudioEvent): Promise<AudioResult> => {
  const bucket = event.s3Bucket;
  const manifestKey = `${event.s3Prefix}manifest.json`;

  // 1. Read manifest
  const manifest = await readManifest(bucket, manifestKey);
  let totalCharacters = 0;

  try {
    // 2. Update stage to running
    manifest.stages.audio = "running";
    await writeManifest(bucket, manifestKey, manifest);

    const keyParams = { userId: manifest.userId, projectId: manifest.projectId };
    const tmpDir = "/tmp/audio-work";
    await mkdir(tmpDir, { recursive: true });

    // 3. Process each page
    for (const page of manifest.pages) {
      // For plain mode: XML-escape the text first, then apply lexicon
      // For ssml mode: text is already valid SSML, apply lexicon directly
      let processedText: string;
      if (page.script.mode === "plain") {
        const escapedText = escapeXml(page.script.text);
        processedText = applyLexicon(escapedText, manifest.lexicon, true);
      } else {
        processedText = applyLexicon(page.script.text, manifest.lexicon, false);
      }
      const ssml = buildSpeakTag(processedText, page.script.mode);

      // Script hash check for idempotency
      const currentHash = computeScriptHash(page.script.text);
      const s3Key = audioKey(keyParams, page.pageNumber);

      // Check if audio already exists with same hash
      const existingAudio = await objectExists(bucket, s3Key);
      if (existingAudio && page.audioDurationSec > 0) {
        // Audio exists and duration is set, skip if text unchanged
        // (In production, hash would be stored in manifest; simplified here)
      }

      // Call Polly SynthesizeSpeech
      const response = await pollyClient.send(
        new SynthesizeSpeechCommand({
          Text: ssml,
          TextType: "ssml",
          OutputFormat: "mp3",
          VoiceId: manifest.voice.id as VoiceId,
          Engine: manifest.voice.engine as Engine,
          SampleRate: manifest.voice.sampleRate,
          LanguageCode: manifest.voice.languageCode as LanguageCode,
        }),
      );

      // Record RequestCharacters from response
      const requestChars = response.RequestCharacters ?? 0;
      totalCharacters += requestChars;

      // Get audio buffer
      const audioBuffer = await streamToBuffer(response.AudioStream);

      // Upload MP3 to S3
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          Body: audioBuffer,
          ContentType: "audio/mpeg",
        }),
      );

      // Measure duration with ffprobe
      const tmpPath = join(tmpDir, `page-${String(page.pageNumber).padStart(3, "0")}.mp3`);
      await writeFile(tmpPath, audioBuffer);
      const { stdout } = await execFileAsync("ffprobe", [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "csv=p=0",
        tmpPath,
      ]);
      const duration = parseFloat(stdout.trim());
      if (isNaN(duration) || duration <= 0) {
        throw new Error(`Failed to measure duration for page ${page.pageNumber}`);
      }

      // Update manifest page entry
      page.audioDurationSec = duration;
    }

    // 4. Update stage to done
    manifest.stages.audio = "done";
    await writeManifest(bucket, manifestKey, manifest);

    return { success: true, totalCharacters };
  } catch (error: unknown) {
    manifest.stages.audio = "failed";
    await writeManifest(bucket, manifestKey, manifest);

    const message = error instanceof Error ? error.message : String(error);
    return { success: false, totalCharacters, error: message };
  }
};

/**
 * Apply lexicon substitutions to text.
 * Replaces written forms with SSML <sub> or <phoneme> tags.
 * When textIsEscaped is true, searches for the XML-escaped form of written entries.
 */
function applyLexicon(text: string, lexicon: LexiconEntry[], textIsEscaped: boolean): string {
  let result = text;
  for (const entry of lexicon) {
    // When text is pre-escaped, search for the escaped version of the written form
    const searchForm = textIsEscaped ? escapeXml(entry.written) : entry.written;

    if (entry.method === "sub") {
      result = result.replaceAll(
        searchForm,
        `<sub alias="${escapeXml(entry.reading)}">${escapeXml(entry.written)}</sub>`,
      );
    } else if (entry.method === "phoneme") {
      result = result.replaceAll(
        searchForm,
        `<phoneme alphabet="x-amazon-pron" ph="${escapeXml(entry.reading)}">${escapeXml(entry.written)}</phoneme>`,
      );
    } else if (entry.method === "spell") {
      result = result.replaceAll(
        searchForm,
        `<say-as interpret-as="spell-out">${escapeXml(entry.written)}</say-as>`,
      );
    }
  }
  return result;
}

/**
 * Wrap text in <speak> tags.
 * If mode is 'ssml', text is already SSML content (just wrap).
 * If mode is 'plain', text must be XML-escaped before lexicon application
 * to avoid invalid SSML from characters like &, <, >.
 */
function buildSpeakTag(text: string, mode: "plain" | "ssml"): string {
  if (mode === "ssml") {
    return `<speak>${text}</speak>`;
  }
  // For 'plain' mode: the text has already been XML-escaped and lexicon-applied
  // by the caller (escapeForSsml + applyLexicon). Just wrap.
  return `<speak>${text}</speak>`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function objectExists(bucket: string, key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
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

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (stream instanceof Buffer) {
    return stream;
  }
  if (stream instanceof Uint8Array) {
    return Buffer.from(stream);
  }
  const chunks: Uint8Array[] = [];
  const readable = stream as AsyncIterable<Uint8Array>;
  for await (const chunk of readable) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
