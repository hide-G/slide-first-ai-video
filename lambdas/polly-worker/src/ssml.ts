/**
 * SSML builder for Amazon Polly.
 * Wraps presenter note text in <speak> tags with optional prosody control.
 */

export interface SsmlOptions {
  /** Prosody rate (e.g., "medium", "slow", "fast", "+10%") */
  prosodyRate?: string;
  /** Whether to apply Japanese phoneme corrections for AWS service names */
  useAwsLexicon?: boolean;
}

/**
 * AWS service names that need Japanese phoneme correction via lexicon.
 */
const AWS_SERVICE_LEXICON = "aws-service-names";

/**
 * Build SSML from presenter note text.
 * Wraps text in <speak> tags with optional prosody rate control.
 */
export function buildSsml(text: string, options?: SsmlOptions): string {
  const { prosodyRate, useAwsLexicon } = options ?? {};

  let innerContent = escapeXml(text);

  if (prosodyRate) {
    innerContent = `<prosody rate="${prosodyRate}">${innerContent}</prosody>`;
  }

  const lexiconAttr = useAwsLexicon
    ? `\n  <lexicon name="${AWS_SERVICE_LEXICON}"/>`
    : "";

  return `<speak>${lexiconAttr}\n  ${innerContent}\n</speak>`;
}

/**
 * Escape special XML characters in text content.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Calculate billable character count for Polly.
 * SSML tags are not counted, only the text content.
 * For plain text input, the entire string is billable.
 */
export function countBillableChars(text: string): number {
  return text.length;
}

/**
 * Maximum billable characters allowed per Polly request.
 */
export const MAX_BILLABLE_CHARS = 3000;
