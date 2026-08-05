/**
 * DynamoDB operations for Version entities.
 */

import { PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";

export interface VersionRecord {
  projectId: string;
  versionNumber: number;
  userId: string;
  deckMarkdownKey: string;
  status: string;
  slideCount?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create a new version record.
 */
export async function createVersion(version: VersionRecord): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `PROJECT#${version.projectId}`,
        SK: `VERSION#${String(version.versionNumber).padStart(4, "0")}`,
        ...version,
      },
    }),
  );
}

/**
 * Get a version by project and version number.
 */
export async function getVersion(
  projectId: string,
  versionNumber: number,
): Promise<VersionRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `PROJECT#${projectId}`,
        SK: `VERSION#${String(versionNumber).padStart(4, "0")}`,
      },
    }),
  );

  return (result.Item as VersionRecord) ?? null;
}

/**
 * Update version status (e.g., to SLIDE_APPROVED).
 */
export async function updateVersionStatus(
  projectId: string,
  versionNumber: number,
  status: string,
): Promise<void> {
  const now = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `PROJECT#${projectId}`,
        SK: `VERSION#${String(versionNumber).padStart(4, "0")}`,
      },
      UpdateExpression: "SET #status = :status, #updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#status": "status",
        "#updatedAt": "updatedAt",
      },
      ExpressionAttributeValues: {
        ":status": status,
        ":updatedAt": now,
      },
    }),
  );
}
