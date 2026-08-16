/**
 * Script hash utility for cost control (section 12).
 *
 * A hash of the script text is used to detect whether audio needs
 * regeneration. If the script text has not changed since the last render,
 * the existing audio file can be reused - avoiding Polly charges.
 */

import { createHash } from "node:crypto";

/**
 * Generate a SHA-256 hash of a script text string.
 * Returns a hex-encoded hash.
 */
export function computeScriptHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Check if a script's text has changed by comparing hashes.
 */
export function hasScriptChanged(
  currentText: string,
  previousHash: string,
): boolean {
  const currentHash = computeScriptHash(currentText);
  return currentHash !== previousHash;
}
