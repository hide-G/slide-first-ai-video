/**
 * Post text generation for X (Twitter).
 * Generates post text with hashtags and source page links from slide references.
 */

import type { PostText } from "@slide-first/shared-types";

/** Maximum characters for X post (excluding media URL) */
const MAX_POST_LENGTH = 280;

/**
 * Parse post text from Bedrock JSON response.
 */
export function parsePostText(bedrockResponse: string): PostText {
  const parsed = JSON.parse(bedrockResponse);

  const text = parsed.text?.trim();
  if (!text) {
    throw new Error("Invalid post text response: missing text field");
  }

  if (text.length > MAX_POST_LENGTH) {
    throw new Error(
      `Post text exceeds ${MAX_POST_LENGTH} characters: ${text.length}`,
    );
  }

  const hashtags: string[] = (parsed.hashtags ?? []).map((tag: string) =>
    tag.startsWith("#") ? tag : `#${tag}`,
  );

  const sourceLinks: string[] = (parsed.sourceLinks ?? []).filter(
    (link: string) => link && link.startsWith("http"),
  );

  return { text, hashtags, sourceLinks };
}

/**
 * Extract source URLs from references array.
 * Filters for valid HTTP(S) URLs.
 */
export function extractSourceLinks(references: string[]): string[] {
  return references.filter(
    (ref) => ref.startsWith("http://") || ref.startsWith("https://"),
  );
}
