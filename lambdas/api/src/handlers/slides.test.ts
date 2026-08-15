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
  ulid: vi.fn(() => "01TESTJOBID00000001"),
}));

import type { APIGatewayProxyEvent } from "aws-lambda";
import { handleStartSlides } from "./slides.js";
import { createRestApiEvent } from "../test-utils/rest-api-event.js";

function makeEvent(
  overrides: Partial<APIGatewayProxyEvent> = {},
): APIGatewayProxyEvent {
  return {
    ...createRestApiEvent({
      httpMethod: "POST",
      path: "/v1/projects/proj-001/slides",
      headers: { "content-type": "application/json" },
      pathParameters: { id: "proj-001" },
      body: JSON.stringify({}),
    }),
    ...overrides,
  };
}

describe("handleStartSlides", () => {
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

  it("creates a job and returns 202", async () => {
    // getProject returns a valid project
    mockSend.mockImplementation((cmd: { type: string }) => {
      if (cmd.type === "Get") {
        return {
          Item: {
            projectId: "proj-001",
            userId: "user-123",
            title: "Test",
            status: "DRAFT",
            currentVersion: 0,
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        };
      }
      return {};
    });

    const event = makeEvent();
    const result = await handleStartSlides(event);

    expect(result.statusCode).toBe(202);
    const body = JSON.parse(result.body as string);
    expect(body.jobId).toBe("01TESTJOBID00000001");
    expect(body.projectId).toBe("proj-001");
    expect(body.status).toBe("PENDING");
  });

  it("returns 404 if project not found", async () => {
    mockSend.mockImplementation((cmd: { type: string }) => {
      if (cmd.type === "Get") return { Item: undefined };
      return {};
    });

    const event = makeEvent();
    await expect(handleStartSlides(event)).rejects.toThrow("Project not found");
  });

  it("returns 403 if user does not own project", async () => {
    mockSend.mockImplementation((cmd: { type: string }) => {
      if (cmd.type === "Get") {
        return {
          Item: {
            projectId: "proj-001",
            userId: "other-user",
            title: "Test",
            status: "DRAFT",
            currentVersion: 0,
          },
        };
      }
      return {};
    });

    const event = makeEvent();
    await expect(handleStartSlides(event)).rejects.toThrow("Access denied");
  });
});
