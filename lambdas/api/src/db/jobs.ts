/**
 * DynamoDB operations for Job entities.
 */

import { PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";

export interface JobRecord {
  jobId: string;
  projectId: string;
  userId: string;
  versionNumber: number;
  type: "RENDER" | "GENERATE" | "EXPORT";
  status: string;
  progress?: string;
  executionArn?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create a new job record.
 */
export async function createJob(job: JobRecord): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `JOB#${job.jobId}`,
        SK: `META`,
        GSI1PK: `PROJECT#${job.projectId}`,
        GSI1SK: `JOB#${job.createdAt}`,
        ...job,
      },
    }),
  );
}

/**
 * Get a job by ID.
 */
export async function getJob(jobId: string): Promise<JobRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `JOB#${jobId}`,
        SK: `META`,
      },
    }),
  );

  return (result.Item as JobRecord) ?? null;
}

/**
 * Update job progress/status.
 */
export async function updateJobProgress(
  jobId: string,
  status: string,
  progress?: string,
  error?: string,
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

  if (progress !== undefined) {
    updateExpression += ", #progress = :progress";
    expressionNames["#progress"] = "progress";
    expressionValues[":progress"] = progress;
  }

  if (error !== undefined) {
    updateExpression += ", #error = :error";
    expressionNames["#error"] = "error";
    expressionValues[":error"] = error;
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `JOB#${jobId}`,
        SK: `META`,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
    }),
  );
}
