import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all AWS SDKs
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
    ListObjectsV2Command: vi.fn((input) => ({ input })),
    __mockSend: mockSend,
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => "https://presigned.example.com"),
}));

vi.mock("@aws-sdk/client-sfn", () => {
  const mockSend = vi.fn();
  return {
    SFNClient: vi.fn(() => ({ send: mockSend })),
    StartExecutionCommand: vi.fn((input) => ({ input })),
    __mockSend: mockSend,
  };
});

vi.mock("ulid", () => ({
  ulid: vi.fn(() => "01TESTROUTERID00001"),
}));

import type { APIGatewayProxyEventV2, Context } from "aws-lambda";
import { handler } from "./index.js";

const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: "test",
  functionVersion: "1",
  invokedFunctionArn: "arn:aws:lambda:us-east-1:123:function:test",
  memoryLimitInMB: "128",
  awsRequestId: "req-123",
  logGroupName: "/aws/lambda/test",
  logStreamName: "stream",
  getRemainingTimeInMillis: () => 5000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

function makeEvent(
  method: string,
  path: string,
  overrides: Partial<APIGatewayProxyEventV2> = {},
): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: "",
    headers: { "content-type": "application/json" },
    requestContext: {
      accountId: "123456789",
      apiId: "api-id",
      authorizer: { jwt: { claims: { sub: "user-123" }, scopes: [] } },
      domainName: "api.example.com",
      domainPrefix: "api",
      http: {
        method,
        path,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test",
      },
      requestId: "req-id",
      routeKey: `${method} ${path}`,
      stage: "$default",
      time: "01/Jan/2024:00:00:00 +0000",
      timeEpoch: 1704067200000,
    },
    body: null,
    isBase64Encoded: false,
    ...overrides,
  } as unknown as APIGatewayProxyEventV2;
}

describe("API Router", () => {
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dynamoModule = await import("@aws-sdk/lib-dynamodb");
    mockSend = (
      dynamoModule as unknown as { __mockSend: ReturnType<typeof vi.fn> }
    ).__mockSend;
    mockSend.mockResolvedValue({});
  });

  it("returns 404 for unknown routes", async () => {
    const event = makeEvent("GET", "/v1/unknown");
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body as string);
    expect(body.error).toBe("NOT_FOUND");
  });

  it("routes POST /v1/projects correctly", async () => {
    const event = makeEvent("POST", "/v1/projects", {
      body: JSON.stringify({ title: "Router Test" }),
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body as string);
    expect(body.title).toBe("Router Test");
  });

  it("routes GET /v1/jobs/{jobId} correctly", async () => {
    mockSend.mockResolvedValue({
      Item: {
        jobId: "job-abc",
        projectId: "proj-001",
        userId: "user-123",
        versionNumber: 1,
        type: "GENERATE",
        status: "PENDING",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    });

    const event = makeEvent("GET", "/v1/jobs/job-abc");
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string);
    expect(body.jobId).toBe("job-abc");
  });

  it("handles errors gracefully", async () => {
    // No auth context
    const event = makeEvent("POST", "/v1/projects", {
      body: JSON.stringify({ title: "Test" }),
      requestContext: {
        accountId: "123456789",
        apiId: "api-id",
        domainName: "api.example.com",
        domainPrefix: "api",
        http: {
          method: "POST",
          path: "/v1/projects",
          protocol: "HTTP/1.1",
          sourceIp: "127.0.0.1",
          userAgent: "test",
        },
        requestId: "req-id",
        routeKey: "POST /v1/projects",
        stage: "$default",
        time: "01/Jan/2024:00:00:00 +0000",
        timeEpoch: 1704067200000,
      } as unknown as APIGatewayProxyEventV2["requestContext"],
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(401);
  });
});
