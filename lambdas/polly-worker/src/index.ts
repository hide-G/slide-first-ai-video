/**
 * Amazon Polly TTS worker Lambda handler.
 * Generates audio (PCM) and speech marks (JSON) for slide presenter notes.
 *
 * Makes two SynthesizeSpeech calls:
 * 1. OutputFormat 'pcm' for audio data
 * 2. OutputFormat 'json' for speech marks (word + sentence)
 *
 * Uploads results to S3 and returns metadata including measured audio duration.
 */

import {
  PollyClient,
  SynthesizeSpeechCommand,
  type SynthesizeSpeechCommandInput,
  type VoiceId,
  type Engine,
} from "@aws-sdk/client-polly";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { calculatePcmDurationMs } from "@slide-first/core";
import { buildSsml, countBillableChars, MAX_BILLABLE_CHARS } from "./ssml.js";

/** Input event for the Polly worker Lambda */
export interface PollyWorkerEvent {
  projectId: string;
  userId: string;
  version: number;
  slideNumber: number;
  presenterNote: string;
  voiceId: string;
  engine: string;
  sampleRate: string;
  s3Bucket: string;
  s3Prefix: string;
  /** Optional prosody rate */
  prosodyRate?: string;
  /** Optional: use AWS lexicon for Japanese phoneme corrections */
  useAwsLexicon?: boolean;
}

/** Output from the Polly worker Lambda */
export interface PollyWorkerResult {
  slideNumber: number;
  voiceKey: string;
  speechMarksKey: string;
  measuredAudioMs: number;
}

const pollyClient = new PollyClient({});
const s3Client = new S3Client({});

/**
 * Lambda handler for Polly TTS worker.
 */
export const handler = async (event: PollyWorkerEvent): Promise<PollyWorkerResult> => {
  const {
    presenterNote,
    voiceId,
    engine,
    sampleRate,
    s3Bucket,
    s3Prefix,
    slideNumber,
    prosodyRate,
    useAwsLexicon,
  } = event;

  // Validate text length
  const billableChars = countBillableChars(presenterNote);
  if (billableChars > MAX_BILLABLE_CHARS) {
    throw new Error(
      `Text exceeds maximum billable character limit: ${billableChars} > ${MAX_BILLABLE_CHARS}`,
    );
  }

  // Build SSML
  const ssml = buildSsml(presenterNote, { prosodyRate, useAwsLexicon });

  // Pad slide number for key construction
  const paddedSlide = String(slideNumber).padStart(3, "0");
  const voiceKey = `${s3Prefix}audio/slide-${paddedSlide}.pcm`;
  const speechMarksKey = `${s3Prefix}audio/slide-${paddedSlide}-marks.json`;

  // Synthesize PCM audio
  const pcmInput: SynthesizeSpeechCommandInput = {
    Text: ssml,
    TextType: "ssml",
    OutputFormat: "pcm",
    VoiceId: voiceId as VoiceId,
    Engine: engine as Engine,
    SampleRate: sampleRate,
  };

  const pcmResponse = await pollyClient.send(new SynthesizeSpeechCommand(pcmInput));
  const pcmBuffer = await streamToBuffer(pcmResponse.AudioStream);

  // Synthesize speech marks (JSON)
  const marksInput: SynthesizeSpeechCommandInput = {
    Text: ssml,
    TextType: "ssml",
    OutputFormat: "json",
    VoiceId: voiceId as VoiceId,
    Engine: engine as Engine,
    SampleRate: sampleRate,
    SpeechMarkTypes: ["word", "sentence"],
  };

  const marksResponse = await pollyClient.send(new SynthesizeSpeechCommand(marksInput));
  const marksBuffer = await streamToBuffer(marksResponse.AudioStream);

  // Upload PCM to S3
  await s3Client.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: voiceKey,
      Body: pcmBuffer,
      ContentType: "audio/pcm",
    }),
  );

  // Upload speech marks to S3
  await s3Client.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: speechMarksKey,
      Body: marksBuffer,
      ContentType: "application/json",
    }),
  );

  // Calculate measured audio duration from PCM byte count
  const measuredAudioMs = calculatePcmDurationMs(pcmBuffer.length, {
    sampleRate: parseInt(sampleRate, 10),
  });

  return {
    slideNumber,
    voiceKey,
    speechMarksKey,
    measuredAudioMs,
  };
};

/**
 * Convert a readable stream to a Buffer.
 */
async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (stream instanceof Buffer) {
    return stream;
  }
  if (stream instanceof Uint8Array) {
    return Buffer.from(stream);
  }

  // Handle SDK stream types
  const chunks: Uint8Array[] = [];
  const readable = stream as AsyncIterable<Uint8Array>;
  for await (const chunk of readable) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
