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

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handleGetVersion } from "./versions.js";

function makeEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "GET /v1/projects/{id}/versions/{version}",
    rawPath: "/v1/projects/proj-001/versions/1",
    rawQueryString: "",
    headers: {},
    pathParameters: { id: "proj-001", version: "1" },
    requestContext: {
      accountId: "123456789",
      apiId: "api-id",
      authorizer: { jwt: { claims: { sub: "user-123" }, scopes: [] } },
      domainName: "api.example.com",
      domainPrefix: "api",
      http: { method: "GET", path: "/v1/projects/proj-001/versions/1", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "test" },
      requestId: "req-id",
      routeKey: "GET /v1/projects/{id}/versions/{version}",
      stage: "$default",
      time: "01/Jan/2024:00:00:00 +0000",
      timeEpoch: 1704067200000,
    },
    body: null,
    isBase64Encoded: false,
    ...overrides,
  } as unknown as APIGatewayProxyEventV2;
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
