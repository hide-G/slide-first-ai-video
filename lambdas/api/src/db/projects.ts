/**
 * DynamoDB operations for Project entities.
 */

import { PutCommand, GetCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";

export interface ProjectRecord {
  projectId: string;
  userId: string;
  title: string;
  theme?: string;
  audience?: string;
  duration?: number;
  urls?: string[];
  status: string;
  currentVersion: number;
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
        PK: `PROJECT#${project.projectId}`,
        SK: `META`,
        GSI1PK: `USER#${project.userId}`,
        GSI1SK: `PROJECT#${project.createdAt}`,
        ...project,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );
}

/**
 * Get a project by ID.
 */
export async function getProject(
  projectId: string,
): Promise<ProjectRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `PROJECT#${projectId}`,
        SK: `META`,
      },
    }),
  );

  return (result.Item as ProjectRecord) ?? null;
}

/**
 * Update project status.
 */
export async function updateProjectStatus(
  projectId: string,
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
        SK: `META`,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
    }),
  );
}

/**
 * Update project version and status atomically.
 */
export async function incrementProjectVersion(
  projectId: string,
  expectedVersion: number,
): Promise<number> {
  const newVersion = expectedVersion + 1;
  const now = new Date().toISOString();

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `PROJECT#${projectId}`,
          SK: `META`,
        },
        UpdateExpression:
          "SET #currentVersion = :newVersion, #updatedAt = :updatedAt",
        ConditionExpression: "#currentVersion = :expectedVersion",
        ExpressionAttributeNames: {
          "#currentVersion": "currentVersion",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":newVersion": newVersion,
          ":expectedVersion": expectedVersion,
          ":updatedAt": now,
        },
      }),
    );
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      throw new Error("Version conflict: project was modified concurrently");
    }
    throw err;
  }

  return newVersion;
}

/**
 * List projects by userId using GSI1.
 */
export async function listProjectsByUser(
  userId: string,
  nextToken?: string,
): Promise<{ projects: ProjectRecord[]; nextToken?: string }> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}`,
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
