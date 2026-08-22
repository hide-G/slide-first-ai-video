/**
 * DynamoDB operations for Render entities.
 * Single table design: PK=PROJECT#{projectId}, SK=RENDER#{renderId}
 */

import { PutCommand, GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";

export interface RenderRecord {
  renderId: string;
  projectId: string;
  userId: string;
  status: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  currentStage?: string;
  currentPage?: number;
  totalPages?: number;
  progressMessage?: string;
  progressUpdatedAt?: string;
  error?: string;
  executionArn?: string;
}

/**
 * Create a new render record.
 */
export async function createRender(render: RenderRecord): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `PROJECT#${render.projectId}`,
        SK: `RENDER#${render.renderId}`,
        GSI1PK: `RENDER#${render.renderId}`,
        GSI1SK: "META",
        ...render,
      },
    }),
  );
}

/**
 * Get a render by projectId and renderId.
 */
export async function getRender(projectId: string, renderId: string): Promise<RenderRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `PROJECT#${projectId}`,
        SK: `RENDER#${renderId}`,
      },
    }),
  );

  return (result.Item as RenderRecord) ?? null;
}

/**
 * List renders for a project.
 */
export async function listRendersByProject(projectId: string): Promise<RenderRecord[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `PROJECT#${projectId}`,
        ":skPrefix": "RENDER#",
      },
      ScanIndexForward: false,
    }),
  );

  return (result.Items ?? []) as RenderRecord[];
}

/**
 * Update render status.
 */
export async function updateRenderStatus(
  projectId: string,
  renderId: string,
  status: string,
  additionalUpdates?: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString();
  let updateExpression = "SET #status = :status, #updatedAt = :updatedAt";
  const expressionNames: Record<string, string> = {
    "#status": "status",
    "#updatedAt": "updatedAt",
  };
  const expressionValues: Record<string, unknown> = {
    ":status": status,
    ":updatedAt": now,
  };

  if (additionalUpdates) {
    for (const [key, value] of Object.entries(additionalUpdates)) {
      // DynamoDB の式属性値に undefined は渡せないため、任意項目は明示的に除外する。
      if (value === undefined) continue;
      updateExpression += `, #${key} = :${key}`;
      expressionNames[`#${key}`] = key;
      expressionValues[`:${key}`] = value;
    }
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `PROJECT#${projectId}`,
        SK: `RENDER#${renderId}`,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
    }),
  );
}
