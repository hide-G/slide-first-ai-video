/**
 * Hook text generation for teaser videos.
 * Generates 3 hook text candidates using Bedrock, each under 2 seconds reading time.
 */

import type { HookTextCandidate } from "@slide-first/shared-types";

/** Maximum reading time for a hook in milliseconds */
const MAX_HOOK_READING_TIME_MS = 2000;

/** Estimated reading speed for on-screen text (words per second) */
const WORDS_PER_SECOND = 4;

/**
 * Estimate reading time for on-screen text in milliseconds.
 * Uses a faster rate than narration since hooks are short visual text.
 */
export function estimateHookReadingTimeMs(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  const wordCount = text.trim().split(/\s+/).length;
  return Math.round((wordCount / WORDS_PER_SECOND) * 1000);
}

/**
 * Parse hook candidates from Bedrock JSON response.
 * Validates each hook is within reading time limit.
 */
export function parseHookCandidates(
  bedrockResponse: string,
): HookTextCandidate[] {
  const parsed = JSON.parse(bedrockResponse);

  if (!parsed.hooks || !Array.isArray(parsed.hooks)) {
    throw new Error("Invalid hook response: missing hooks array");
  }

  return parsed.hooks.map(
    (hook: { text: string; rank: number }, index: number) => {
      const text = hook.text?.trim();
      if (!text) {
        throw new Error(`Hook at index ${index} has empty text`);
      }

      const estimatedReadingTimeMs = estimateHookReadingTimeMs(text);

      return {
        text,
        estimatedReadingTimeMs,
        rank: hook.rank ?? index + 1,
      };
    },
  );
}

/**
 * Validate that all hook candidates are within the reading time limit.
 */
export function validateHookCandidates(
  candidates: HookTextCandidate[],
): { valid: boolean; invalidHooks: string[] } {
  const invalidHooks: string[] = [];

  for (const candidate of candidates) {
    if (candidate.estimatedReadingTimeMs > MAX_HOOK_READING_TIME_MS) {
      invalidHooks.push(
        `"${candidate.text}" (${candidate.estimatedReadingTimeMs}ms exceeds ${MAX_HOOK_READING_TIME_MS}ms)`,
      );
    }
  }

  return {
    valid: invalidHooks.length === 0,
    invalidHooks,
  };
}
