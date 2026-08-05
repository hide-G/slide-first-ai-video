/**
 * DynamoDB operations for Idempotency records.
 * Uses conditional writes to prevent duplicate processing.
 */

import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";

export interface IdempotencyRecord {
  idempotencyKey: string;
  userId: string;
  responseStatus: number;
  responseBody: string;
  createdAt: string;
  /** TTL for automatic cleanup (24 hours) */
  ttl: number;
}

/**
 * Try to claim an idempotency key.
 * Returns null if successfully claimed (first request).
 * Returns the stored record if already claimed (duplicate request).
 */
export async function putIfAbsent(
  key: string,
  userId: string,
): Promise<IdempotencyRecord | null> {
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 86400; // 24 hours

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `IDEMPOTENCY#${key}`,
          SK: `META`,
          idempotencyKey: key,
          userId,
          responseStatus: 0, // Not yet completed
          responseBody: "",
          createdAt: now,
          ttl,
        },
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
    return null; // Successfully claimed
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      // Key already exists, return stored response
      return getIdempotencyRecord(key);
    }
    throw err;
  }
}

/**
 * Get an existing idempotency record.
 */
export async function getIdempotencyRecord(
  key: string,
): Promise<IdempotencyRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `IDEMPOTENCY#${key}`,
        SK: `META`,
      },
    }),
  );

  return (result.Item as IdempotencyRecord) ?? null;
}

/**
 * Store the response for a completed idempotent operation.
 */
export async function completeIdempotencyRecord(
  key: string,
  userId: string,
  responseStatus: number,
  responseBody: string,
): Promise<void> {
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 86400;

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `IDEMPOTENCY#${key}`,
        SK: `META`,
        idempotencyKey: key,
        userId,
        responseStatus,
        responseBody,
        createdAt: now,
        ttl,
      },
    }),
  );
}
