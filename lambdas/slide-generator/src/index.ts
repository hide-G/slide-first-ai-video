/**
 * Bedrock slide generation Lambda handler.
 * Uses Converse API to generate Marp Markdown with presenter notes
 * and keyPoints, validates output, saves to S3.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { SlideImportance } from "@slide-first/shared-types";
import { callBedrockConverse, type BedrockConfig } from "./bedrock-client.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompts.js";
import { parseBedrockOutput } from "./parser.js";
import { extractSlideNotes, type SlideNoteEntry } from "./notes-extractor.js";
import { validateSlides } from "./validator.js";

/** Input event for the slide generator Lambda */
export interface SlideGeneratorEvent {
  projectId: string;
  userId: string;
  version: number;
  theme: string;
  audience: string;
  durationMinutes: number;
  urls: string[];
  s3Bucket: string;
  s3Prefix: string;
  /** Optional reference content (pre-fetched from URLs) */
  referenceContent?: string;
}

/** Slide metadata in the output */
export interface SlideOutput {
  slideNumber: number;
  presenterNote: string;
  keyPoints: string[];
  importance: SlideImportance;
  teaserNote: string;
  includeInXTeaser: boolean;
}

/** Output from the slide generator Lambda */
export interface SlideGeneratorResult {
  deckKey: string;
  slideCount: number;
  slides: SlideOutput[];
  inputTokens?: number;
  outputTokens?: number;
}

const s3Client = new S3Client({});

/** Default max tokens for slide generation */
const DEFAULT_MAX_TOKENS = 8000;

/**
 * Lambda handler for slide generation.
 */
export const handler = async (event: SlideGeneratorEvent): Promise<SlideGeneratorResult> => {
  const {
    theme,
    audience,
    durationMinutes,
    urls,
    s3Bucket,
    s3Prefix,
    referenceContent,
  } = event;

  // Model ID from environment - NEVER hardcoded
  const modelId = process.env.BEDROCK_MODEL_ID;
  if (!modelId) {
    throw new Error("BEDROCK_MODEL_ID environment variable is required");
  }

  const maxTokens = process.env.BEDROCK_MAX_TOKENS
    ? parseInt(process.env.BEDROCK_MAX_TOKENS, 10)
    : DEFAULT_MAX_TOKENS;

  const config: BedrockConfig = {
    modelId,
    maxTokens,
  };

  // Build prompts
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({
    theme,
    audience,
    durationMinutes,
    urls,
    referenceContent,
  });

  // Call Bedrock Converse API
  const bedrockResult = await callBedrockConverse(systemPrompt, userPrompt, config);

  // Parse the generated output
  const parsed = parseBedrockOutput(bedrockResult.content);

  // Validate the generated slides
  const validation = validateSlides(
    parsed.slides,
    parsed.metadata,
    parsed.frontmatter,
    durationMinutes,
  );

  if (!validation.valid) {
    const errorMessages = validation.errors.map(
      (e) => `Slide ${e.slideNumber} [${e.field}]: ${e.message}`,
    );
    throw new Error(
      `Slide validation failed:\n${errorMessages.join("\n")}`,
    );
  }

  // Extract structured notes
  const slideNotes: SlideNoteEntry[] = extractSlideNotes(parsed.slides, parsed.metadata);

  // Save deck.md to S3
  const deckKey = `${s3Prefix}deck.md`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: deckKey,
      Body: parsed.rawMarkdown,
      ContentType: "text/markdown",
    }),
  );

  // Build output
  const slides: SlideOutput[] = slideNotes.map((note) => ({
    slideNumber: note.slideNumber,
    presenterNote: note.presenterNote,
    keyPoints: note.keyPoints,
    importance: note.importance,
    teaserNote: note.teaserNote,
    includeInXTeaser: note.includeInXTeaser,
  }));

  return {
    deckKey,
    slideCount: slides.length,
    slides,
    inputTokens: bedrockResult.inputTokens,
    outputTokens: bedrockResult.outputTokens,
  };
};
