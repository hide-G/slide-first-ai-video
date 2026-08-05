/**
 * POST /v1/projects/{id}/versions/{version}/approve - Approve slides.
 *
 * Retrieves the Step Functions task token from the approval SQS queue,
 * calls SendTaskSuccess to resume the content state machine, and updates
 * the version status in DynamoDB.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import {
  SFNClient,
  SendTaskSuccessCommand,
} from "@aws-sdk/client-sfn";
import {
  extractUserId,
  buildResponse,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ApiError,
} from "../middleware/index.js";
import { getProject, getVersion, updateVersionStatus } from "../db/index.js";

const sqsClient = new SQSClient({});
const sfnClient = new SFNClient({});

const APPROVAL_QUEUE_URL = process.env.APPROVAL_QUEUE_URL ?? "";

/**
 * Poll the approval queue for the task token matching this project/version.
 * Returns the task token and receipt handle, or null if not found.
 */
async function findTaskToken(
  projectId: string,
  versionNumber: number,
): Promise<{ taskToken: string; receiptHandle: string } | null> {
  // Receive up to 10 messages at a time and check for matching projectId/versionNumber
  const response = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: APPROVAL_QUEUE_URL,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 0,
      VisibilityTimeout: 30,
    }),
  );

  if (!response.Messages || response.Messages.length === 0) {
    return null;
  }

  for (const message of response.Messages) {
    if (!message.Body || !message.ReceiptHandle) continue;

    try {
      const body = JSON.parse(message.Body) as {
        taskToken?: string;
        projectId?: string;
        versionNumber?: number;
      };

      if (
        body.projectId === projectId &&
        body.versionNumber === versionNumber &&
        body.taskToken
      ) {
        return {
          taskToken: body.taskToken,
          receiptHandle: message.ReceiptHandle,
        };
      }
    } catch {
      // Skip malformed messages
      continue;
    }
  }

  return null;
}

export async function handleApprove(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const userId = extractUserId(event);
  if (!userId) {
    throw new UnauthorizedError();
  }

  const projectId = event.pathParameters?.id;
  const versionStr = event.pathParameters?.version;
  if (!projectId || !versionStr) {
    throw new ApiError(400, "Missing path parameters", "MISSING_PARAMETER");
  }

  const versionNumber = parseInt(versionStr, 10);
  if (isNaN(versionNumber) || versionNumber < 1) {
    throw new ApiError(400, "Invalid version number", "INVALID_PARAMETER");
  }

  // Validate project ownership
  const project = await getProject(projectId);
  if (!project) {
    throw new NotFoundError("Project not found");
  }
  if (project.userId !== userId) {
    throw new ForbiddenError("Access denied");
  }

  // Validate version exists and is in correct state
  const version = await getVersion(projectId, versionNumber);
  if (!version) {
    throw new NotFoundError("Version not found");
  }

  if (version.status !== "SLIDE_READY") {
    throw new ConflictError(
      `Cannot approve version in state ${version.status}. Must be SLIDE_READY.`,
    );
  }

  // Find the task token from the approval queue
  const tokenResult = await findTaskToken(projectId, versionNumber);
  if (!tokenResult) {
    throw new ApiError(
      409,
      "Approval task token not found. The state machine may not be waiting for approval.",
      "TOKEN_NOT_FOUND",
    );
  }

  // Resume the state machine by sending task success
  await sfnClient.send(
    new SendTaskSuccessCommand({
      taskToken: tokenResult.taskToken,
      output: JSON.stringify({ projectId, versionNumber, approved: true }),
    }),
  );

  // Delete the processed message from the queue
  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: APPROVAL_QUEUE_URL,
      ReceiptHandle: tokenResult.receiptHandle,
    }),
  );

  // Transition to SLIDE_APPROVED
  await updateVersionStatus(projectId, versionNumber, "SLIDE_APPROVED");

  return buildResponse(200, {
    projectId,
    versionNumber,
    status: "SLIDE_APPROVED",
  });
}
