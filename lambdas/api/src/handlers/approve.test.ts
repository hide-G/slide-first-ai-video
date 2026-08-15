import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(() => ({})),
  ConditionalCheckFailedException: class ConditionalCheckFailedException extends Error {
    constructor() {
      super("Conditional check failed");
      this.name = "ConditionalCheckFailedException";
    }
  },
}));

vi.mock("@aws-sdk/lib-dynamodb", () => {
  const mockSend = vi.fn();
  return {
    DynamoDBDocumentClient: { from: vi.fn(() => ({ send: mockSend })) },
    PutCommand: vi.fn((input) => ({ input, type: "Put" })),
    GetCommand: vi.fn((input) => ({ input, type: "Get" })),
    UpdateCommand: vi.fn((input) => ({ input, type: "Update" })),
    __mockSend: mockSend,
  };
});

vi.mock("@aws-sdk/client-sqs", () => {
  const mockSend = vi.fn();
  return {
    SQSClient: vi.fn(() => ({ send: mockSend })),
    ReceiveMessageCommand: vi.fn((input) => ({ input, type: "ReceiveMessage" })),
    DeleteMessageCommand: vi.fn((input) => ({ input, type: "DeleteMessage" })),
    __mockSend: mockSend,
  };
});

vi.mock("@aws-sdk/client-sfn", () => {
  const mockSend = vi.fn();
  return {
    SFNClient: vi.fn(() => ({ send: mockSend })),
    SendTaskSuccessCommand: vi.fn((input) => ({ input, type: "SendTaskSuccess" })),
    __mockSend: mockSend,
  };
});

import type { APIGatewayProxyEvent } from "aws-lambda";
import { handleApprove } from "./approve.js";
import { createRestApiEvent } from "../test-utils/rest-api-event.js";

function makeEvent(
  overrides: Partial<APIGatewayProxyEvent> = {},
): APIGatewayProxyEvent {
  return {
    ...createRestApiEvent({
      httpMethod: "POST",
      path: "/v1/projects/proj-001/versions/1/approve",
      headers: { "content-type": "application/json" },
      pathParameters: { id: "proj-001", version: "1" },
    }),
    ...overrides,
  };
}

describe("handleApprove", () => {
  let mockSend: ReturnType<typeof vi.fn>;
  let mockSqsSend: ReturnType<typeof vi.fn>;
  let mockSfnSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dynamoModule = await import("@aws-sdk/lib-dynamodb");
    mockSend = (dynamoModule as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    const sqsModule = await import("@aws-sdk/client-sqs");
    mockSqsSend = (sqsModule as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    const sfnModule = await import("@aws-sdk/client-sfn");
    mockSfnSend = (sfnModule as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
  });

  it("approves a version and returns 200", async () => {
    let callCount = 0;
    mockSend.mockImplementation((cmd: { type: string }) => {
      if (cmd.type === "Get") {
        callCount++;
        if (callCount === 1) {
          // getProject
          return {
            Item: {
              projectId: "proj-001",
              userId: "user-123",
              title: "Test",
              status: "SLIDE_READY",
              currentVersion: 1,
            },
          };
        }
        // getVersion
        return {
          Item: {
            projectId: "proj-001",
            versionNumber: 1,
            userId: "user-123",
            status: "SLIDE_READY",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        };
      }
      return {};
    });

    // Mock SQS to return a message with task token matching the request
    mockSqsSend.mockResolvedValue({
      Messages: [
        {
          Body: JSON.stringify({
            taskToken: "test-task-token-abc",
            projectId: "proj-001",
            versionNumber: 1,
          }),
          ReceiptHandle: "receipt-handle-123",
        },
      ],
    });

    // Mock SFN SendTaskSuccess
    mockSfnSend.mockResolvedValue({});

    const event = makeEvent();
    const result = await handleApprove(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string);
    expect(body.status).toBe("SLIDE_APPROVED");

    // Verify SFN was called with the task token
    expect(mockSfnSend).toHaveBeenCalledTimes(1);

    // Verify SQS delete was called
    expect(mockSqsSend).toHaveBeenCalledTimes(2); // receive + delete
  });

  it("rejects if version is not in SLIDE_READY state", async () => {
    let callCount = 0;
    mockSend.mockImplementation((cmd: { type: string }) => {
      if (cmd.type === "Get") {
        callCount++;
        if (callCount === 1) {
          return {
            Item: {
              projectId: "proj-001",
              userId: "user-123",
              title: "Test",
              status: "DRAFT",
              currentVersion: 1,
            },
          };
        }
        return {
          Item: {
            projectId: "proj-001",
            versionNumber: 1,
            userId: "user-123",
            status: "PENDING",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        };
      }
      return {};
    });

    const event = makeEvent();
    await expect(handleApprove(event)).rejects.toThrow("Cannot approve version in state PENDING");
  });

  it("returns 403 if user does not own the project", async () => {
    mockSend.mockImplementation((cmd: { type: string }) => {
      if (cmd.type === "Get") {
        return {
          Item: {
            projectId: "proj-001",
            userId: "different-user",
            title: "Test",
            status: "SLIDE_READY",
            currentVersion: 1,
          },
        };
      }
      return {};
    });

    const event = makeEvent();
    await expect(handleApprove(event)).rejects.toThrow("Access denied");
  });
});
