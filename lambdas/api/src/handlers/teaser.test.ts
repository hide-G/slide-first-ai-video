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

vi.mock("@aws-sdk/client-sfn", () => {
  const mockSend = vi.fn();
  return {
    SFNClient: vi.fn(() => ({ send: mockSend })),
    StartExecutionCommand: vi.fn((input) => ({ input })),
    __mockSend: mockSend,
  };
});

vi.mock("ulid", () => ({
  ulid: vi.fn(() => "01TESTTEASERJOBID01"),
}));

import type { APIGatewayProxyEvent } from "aws-lambda";
import { handleStartTeaser } from "./teaser.js";
import { createRestApiEvent } from "../test-utils/rest-api-event.js";

function makeEvent(
  overrides: Partial<APIGatewayProxyEvent> = {},
): APIGatewayProxyEvent {
  return {
    ...createRestApiEvent({
      httpMethod: "POST",
      path: "/v1/projects/proj-001/videos/teaser",
      headers: { "content-type": "application/json" },
      pathParameters: { id: "proj-001" },
      body: JSON.stringify({ versionNumber: 1 }),
    }),
    ...overrides,
  };
}

describe("handleStartTeaser", () => {
  let mockSend: ReturnType<typeof vi.fn>;
  let sfnMockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dynamoModule = await import("@aws-sdk/lib-dynamodb");
    mockSend = (dynamoModule as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;

    const sfnModule = await import("@aws-sdk/client-sfn");
    sfnMockSend = (sfnModule as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    sfnMockSend.mockResolvedValue({});
  });

  it("starts teaser generation and returns 202", async () => {
    let getCallCount = 0;
    mockSend.mockImplementation((cmd: { type: string }) => {
      if (cmd.type === "Get") {
        getCallCount++;
        if (getCallCount === 1) {
          return {
            Item: {
              projectId: "proj-001",
              userId: "user-123",
              title: "Test",
              status: "SLIDE_APPROVED",
              currentVersion: 1,
            },
          };
        }
        return {
          Item: {
            projectId: "proj-001",
            versionNumber: 1,
            userId: "user-123",
            status: "SLIDE_APPROVED",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        };
      }
      return {};
    });

    const event = makeEvent();
    const result = await handleStartTeaser(event);

    expect(result.statusCode).toBe(202);
    const body = JSON.parse(result.body as string);
    expect(body.jobId).toBe("01TESTTEASERJOBID01");
    expect(body.status).toBe("PENDING");
  });

  it("rejects if version is not SLIDE_APPROVED", async () => {
    let getCallCount = 0;
    mockSend.mockImplementation((cmd: { type: string }) => {
      if (cmd.type === "Get") {
        getCallCount++;
        if (getCallCount === 1) {
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

    const event = makeEvent();
    await expect(handleStartTeaser(event)).rejects.toThrow(
      "Cannot start teaser for version in state SLIDE_READY",
    );
  });

  it("returns 403 if user does not own project", async () => {
    mockSend.mockImplementation((cmd: { type: string }) => {
      if (cmd.type === "Get") {
        return {
          Item: {
            projectId: "proj-001",
            userId: "other-user",
            title: "Test",
            status: "SLIDE_APPROVED",
            currentVersion: 1,
          },
        };
      }
      return {};
    });

    const event = makeEvent();
    await expect(handleStartTeaser(event)).rejects.toThrow("Access denied");
  });
});
