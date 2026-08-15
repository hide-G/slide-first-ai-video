/**
 * Idempotency-Key header middleware.
 * Prevents duplicate mutation processing using DynamoDB conditional writes.
 */

import type { APIGatewayProxyEvent } from "aws-lambda";
import { isValidIdempotencyKey } from "@slide-first/core";
import { ApiError } from "./errors.js";

/**
 * Extract and validate the Idempotency-Key header from the request.
 * Returns the key value or null if not present.
 * Throws if the key is present but invalid format.
 */
export function extractIdempotencyKey(
  event: APIGatewayProxyEvent,
): string | null {
  const key =
    event.headers?.["idempotency-key"] ||
    event.headers?.["Idempotency-Key"];

  if (!key) {
    return null;
  }

  if (!isValidIdempotencyKey(key)) {
    throw new ApiError(400, "Invalid Idempotency-Key format. Must be UUID v4.", "INVALID_IDEMPOTENCY_KEY");
  }

  return key;
}
