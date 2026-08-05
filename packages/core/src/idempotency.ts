/**
 * Idempotency key utilities.
 * Mutation API endpoints require an Idempotency-Key header.
 */

import { randomUUID } from "node:crypto";

/**
 * Generate a new idempotency key (UUID v4).
 */
export function generateIdempotencyKey(): string {
  return randomUUID();
}

/**
 * Validate that a string is a valid idempotency key format.
 * Accepts UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
export function isValidIdempotencyKey(key: string): boolean {
  const uuidV4Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(key);
}
