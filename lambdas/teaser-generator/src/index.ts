/**
 * Teaser Generator Lambda handler.
 * Uses Bedrock Converse API to select important slides, generate hook text,
 * and create post text for X (Twitter) teaser videos.
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type SystemContentBlock,
} from "@aws-sdk/client-bedrock-runtime";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import type {
  TeaserGeneratorEvent,
  TeaserGenerationResult,
  VideoManifest,
} from "@slide-first/shared-types";
import { validateTeaserDuration, buildManifestKey } from "@slide-first/core";
import { selectTeaserSlides } from "./slide-selector.js";
import { parseHookCandidates } from "./hook-generator.js";
import { parsePostText } from "./post-text-generator.js";
import {
  buildTeaserSystemPrompt,
  buildSlideSelectionPrompt,
  buildHookTextPrompt,
  buildPostTextPrompt,
  type SlideSelectionInput,
} from "./prompts.js";

/** Default max tokens for teaser generation */
const DEFAULT_MAX_TOKENS = 4000;

/**
 * Call Bedrock Converse API and return the text response.
 */
async function callBedrock(
  client: BedrockRuntimeClient,
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<{ content: string; inputTokens?: number; outputTokens?: number }> {
  const system: SystemContentBlock[] = [{ text: systemPrompt }];
  const messages: Message[] = [
    { role: "user", content: [{ text: userPrompt }] },
  ];

  const command = new ConverseCommand({
    modelId,
    system,
    messages,
    inferenceConfig: { maxTokens },
  });

  const response = await client.send(command);

  const outputContent = response.output?.message?.content;
  if (!outputContent || outputContent.length === 0) {
    throw new Error("Bedrock returned empty response");
  }

  const textBlock = outputContent.find((block) => "text" in block);
  if (!textBlock || !("text" in textBlock) || !textBlock.text) {
    throw new Error("Bedrock response contained no text content");
  }

  return {
    content: textBlock.text,
    inputTokens: response.usage?.inputTokens,
    outputTokens: response.usage?.outputTokens,
  };
}

/**
 * Extract JSON from a response that may contain markdown code fences.
 */
function extractJson(text: string): string {
  // Try to extract from code fence
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  // Try to find a JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  return text.trim();
}

/**
 * Lambda handler for teaser generation.
 */
export const handler = async (
  event: TeaserGeneratorEvent,
): Promise<TeaserGenerationResult> => {
  const { references = [] } = event;

  // Model ID from environment
  const modelId = process.env.BEDROCK_MODEL_ID;
  if (!modelId) {
    throw new Error("BEDROCK_MODEL_ID environment variable is required");
  }

  const maxTokens = process.env.BEDROCK_MAX_TOKENS
    ? parseInt(process.env.BEDROCK_MAX_TOKENS, 10)
    : DEFAULT_MAX_TOKENS;

  // Fetch slides from S3 manifest if not provided directly in the event
  let slides = event.slides;
  if (!slides || slides.length === 0) {
    const bucketName = event.s3Bucket || process.env.BUCKET_NAME;
    if (!bucketName) {
      throw new Error("s3Bucket or BUCKET_NAME environment variable is required to fetch manifest");
    }

    const manifestKey = buildManifestKey({
      userId: event.userId,
      projectId: event.projectId,
      versionNumber: event.versionNumber,
    });

    const s3Client = new S3Client({});
    const getObjectResponse = await s3Client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: manifestKey }),
    );
    const manifestBody = await getObjectResponse.Body?.transformToString();
    if (!manifestBody) {
      throw new Error(`Failed to read manifest from s3://${bucketName}/${manifestKey}`);
    }
    const manifest: VideoManifest = JSON.parse(manifestBody);
    slides = manifest.slides;
  }

  const client = new BedrockRuntimeClient({});
  const systemPrompt = buildTeaserSystemPrompt();

  // Prepare slide inputs for prompts
  const slideInputs: SlideSelectionInput[] = slides.map((s) => ({
    slideNumber: s.slideNumber,
    importance: s.importance,
    includeInXTeaser: s.includeInXTeaser,
    teaserNote: s.teaserNote,
    keyPoints: s.keyPoints,
    measuredAudioMs: s.measuredAudioMs,
  }));

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Step 1: Ask Bedrock to select slides
  const selectionPrompt = buildSlideSelectionPrompt(slideInputs);
  const selectionResult = await callBedrock(
    client,
    modelId,
    systemPrompt,
    selectionPrompt,
    maxTokens,
  );
  totalInputTokens += selectionResult.inputTokens ?? 0;
  totalOutputTokens += selectionResult.outputTokens ?? 0;

  const selectionJson = extractJson(selectionResult.content);
  const selectionParsed = JSON.parse(selectionJson);
  const selectedNumbers: number[] = selectionParsed.selectedSlideNumbers ?? [];

  // Select slides (uses Bedrock selection, falls back to auto)
  const selectedSlides = selectTeaserSlides(slides, selectedNumbers);

  // Get topic from teaserNotes
  const theme = slides
    .slice(0, 3)
    .map((s) => s.keyPoints[0])
    .filter(Boolean)
    .join(", ");

  // Step 2: Generate hook text candidates
  const selectedInputs = slideInputs.filter((s) =>
    selectedSlides.some((sel) => sel.slideNumber === s.slideNumber),
  );
  const hookPrompt = buildHookTextPrompt(selectedInputs, theme);
  const hookResult = await callBedrock(
    client,
    modelId,
    systemPrompt,
    hookPrompt,
    maxTokens,
  );
  totalInputTokens += hookResult.inputTokens ?? 0;
  totalOutputTokens += hookResult.outputTokens ?? 0;

  const hookJson = extractJson(hookResult.content);
  const hookCandidates = parseHookCandidates(hookJson);

  // Step 3: Generate post text
  const postPrompt = buildPostTextPrompt(selectedInputs, references, theme);
  const postResult = await callBedrock(
    client,
    modelId,
    systemPrompt,
    postPrompt,
    maxTokens,
  );
  totalInputTokens += postResult.inputTokens ?? 0;
  totalOutputTokens += postResult.outputTokens ?? 0;

  const postJson = extractJson(postResult.content);
  const postText = parsePostText(postJson);

  // Calculate total duration
  const totalDurationMs = selectedSlides.reduce(
    (sum, s) => sum + s.estimatedDurationMs,
    0,
  );

  // Validate teaser duration is within acceptable range (30-60s)
  const validation = validateTeaserDuration(selectedSlides);
  if (!validation.valid) {
    console.warn(`Teaser duration validation warning: ${validation.reason}`);
  }

  return {
    selectedSlides,
    hookCandidates,
    postText,
    totalDurationMs,
    durationValid: validation.valid,
    durationValidationReason: validation.reason,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  };
};
