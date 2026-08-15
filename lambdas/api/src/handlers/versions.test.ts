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

vi.mock("@aws-sdk/client-s3", () => {
  const mockSend = vi.fn();
  return {
    S3Client: vi.fn(() => ({ send: mockSend })),
    GetObjectCommand: vi.fn((input) => ({ input })),
    __mockSend: mockSend,
  };
});

import type { APIGatewayProxyEvent } from "aws-lambda";
import { handleGetVersion } from "./versions.js";
import { createRestApiEvent } from "../test-utils/rest-api-event.js";

function makeEvent(
  overrides: Partial<APIGatewayProxyEvent> = {},
): APIGatewayProxyEvent {
  return {
    ...createRestApiEvent({
      httpMethod: "GET",
      path: "/v1/projects/proj-001/versions/1",
      pathParameters: { id: "proj-001", version: "1" },
    }),
    ...overrides,
  };
}

describe("handleGetVersion", () => {
  let dynamoMockSend: ReturnType<typeof vi.fn>;
  let s3MockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dynamoModule = await import("@aws-sdk/lib-dynamodb");
    dynamoMockSend = (dynamoModule as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;

    const s3Module = await import("@aws-sdk/client-s3");
    s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
  });

  it("returns version markdown and metadata", async () => {
    let getCallCount = 0;
    dynamoMockSend.mockImplementation((cmd: { type: string }) => {
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
            slideCount: 5,
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        };
      }
      return {};
    });

    s3MockSend.mockResolvedValue({
      Body: { transformToString: async () => "# Slide 1\nContent here" },
    });

    const event = makeEvent();
    const result = await handleGetVersion(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string);
    expect(body.markdown).toBe("# Slide 1\nContent here");
    expect(body.status).toBe("SLIDE_READY");
    expect(body.slideCount).toBe(5);
  });

  it("returns empty markdown if deck.md not found", async () => {
    let getCallCount = 0;
    dynamoMockSend.mockImplementation((cmd: { type: string }) => {
      if (cmd.type === "Get") {
        getCallCount++;
        if (getCallCount === 1) {
          return {
            Item: {
              projectId: "proj-001",
              userId: "user-123",
              title: "Test",
              status: "SLIDE_GENERATING",
              currentVersion: 1,
            },
          };
        }
        return {
          Item: {
            projectId: "proj-001",
            versionNumber: 1,
            userId: "user-123",
            status: "SLIDE_GENERATING",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        };
      }
      return {};
    });

    s3MockSend.mockRejectedValue(new Error("NoSuchKey"));

    const event = makeEvent();
    const result = await handleGetVersion(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string);
    expect(body.markdown).toBe("");
  });

  it("returns 403 for unauthorized access", async () => {
    dynamoMockSend.mockImplementation((cmd: { type: string }) => {
      if (cmd.type === "Get") {
        return {
          Item: {
            projectId: "proj-001",
            userId: "other-user",
            title: "Test",
            status: "SLIDE_READY",
            currentVersion: 1,
          },
        };
      }
      return {};
    });

    const event = makeEvent();
    await expect(handleGetVersion(event)).rejects.toThrow("Access denied");
  });
});
