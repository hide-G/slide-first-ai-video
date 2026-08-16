/**
 * DynamoDB operations for Project entities.
 * Single table design: PK=USER#{userId}, SK=PROJECT#{projectId}
 */

import { PutCommand, GetCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";

export interface ProjectRecord {
  projectId: string;
  userId: string;
  title: string;
  contentLanguage?: string;
  status: string;
  outline?: unknown;
  source?: unknown;
  output?: unknown;
  narration?: unknown;
  voice?: unknown;
  lexicon?: unknown;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create a new project in DynamoDB.
 */
export async function createProject(project: ProjectRecord): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `USER#${project.userId}`,
        SK: `PROJECT#${project.projectId}`,
        GSI1PK: `PROJECT#${project.projectId}`,
        GSI1SK: `META`,
        ...project,
      },
      ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
    }),
  );
}

/**
 * Get a project by ID (query GSI1 by projectId).
 * Used when the caller does not have the userId context.
 */
export async function getProject(
  projectId: string,
): Promise<ProjectRecord | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk AND GSI1SK = :sk",
      ExpressionAttributeValues: {
        ":pk": `PROJECT#${projectId}`,
        ":sk": "META",
      },
      Limit: 1,
    }),
  );

  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  return result.Items[0] as ProjectRecord;
}

/**
 * Get a project by userId + projectId using the primary key (GetItem).
 * Faster and cheaper than getProject (which uses GSI).
 * Inherently proves ownership since the PK includes the userId.
 */
export async function getProjectByUser(
  userId: string,
  projectId: string,
): Promise<ProjectRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `PROJECT#${projectId}`,
      },
    }),
  );

  if (!result.Item) {
    return null;
  }

  return result.Item as ProjectRecord;
}

/**
 * Update project fields.
 */
export async function updateProject(
  userId: string,
  projectId: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString();
  let updateExpression = "SET #updatedAt = :updatedAt";
  const expressionNames: Record<string, string> = {
    "#updatedAt": "updatedAt",
  };
  const expressionValues: Record<string, unknown> = {
    ":updatedAt": now,
  };

  for (const [key, value] of Object.entries(updates)) {
    // 未指定の項目は更新対象から外す。
    // undefined を渡すと DynamoDB 側で値が落ち、参照だけが残った
    // UpdateExpression になって "expression attribute value ... is not defined" で失敗する。
    // voice のような任意項目を省略した呼び出しがこれに該当した。
    if (value === undefined) continue;

    updateExpression += `, #${key} = :${key}`;
    expressionNames[`#${key}`] = key;
    expressionValues[`:${key}`] = value;
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `PROJECT#${projectId}`,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
    }),
  );
}

/**
 * List projects by userId.
 */
export async function listProjectsByUser(
  userId: string,
  nextToken?: string,
): Promise<{ projects: ProjectRecord[]; nextToken?: string }> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ":skPrefix": "PROJECT#",
      },
      ScanIndexForward: false,
      Limit: 50,
      ExclusiveStartKey: nextToken
        ? JSON.parse(Buffer.from(nextToken, "base64url").toString("utf-8"))
        : undefined,
    }),
  );

  const projects = (result.Items ?? []) as ProjectRecord[];
  const lastKey = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64url")
    : undefined;

  return { projects, nextToken: lastKey };
}
