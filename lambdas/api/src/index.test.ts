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
    QueryCommand: vi.fn((input) => ({ input, type: "Query" })),
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

import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { handler } from "./index.js";
import { createRestApiEvent } from "./test-utils/rest-api-event.js";

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

const expectedCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type,Authorization,X-Amz-Date,X-Api-Key,Idempotency-Key",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

function makeEvent(
  method: string,
  path: string,
  overrides: Partial<APIGatewayProxyEvent> = {},
): APIGatewayProxyEvent {
  return {
    ...createRestApiEvent({
      httpMethod: method,
      path,
      headers: { "content-type": "application/json" },
    }),
    ...overrides,
  };
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

  it("returns CORS headers with 404 for unknown routes", async () => {
    const event = makeEvent("GET", "/v1/unknown");
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(404);
    expect(result.headers).toMatchObject(expectedCorsHeaders);
    const body = JSON.parse(result.body);
    expect(body.error).toBe("NOT_FOUND");
  });

  it("routes GET /projects when the REST API path includes the stage", async () => {
    const event = makeEvent("GET", "/v1/projects");
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toMatchObject(expectedCorsHeaders);
    const body = JSON.parse(result.body);
    expect(body.projects).toEqual([]);
  });

  it("routes POST /projects without a leading /v1 path prefix", async () => {
    const event = makeEvent("POST", "/projects", {
      body: JSON.stringify({ title: "Router Test" }),
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(201);
    expect(result.headers).toMatchObject(expectedCorsHeaders);
    const body = JSON.parse(result.body);
    expect(body.project.projectId).toBe("01TESTROUTERID00001");
    expect(body.project.title).toBe("Router Test");
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
    const body = JSON.parse(result.body);
    expect(body.jobId).toBe("job-abc");
  });

  it("adds CORS headers to exception responses", async () => {
    const event = makeEvent("POST", "/projects", {
      body: JSON.stringify({ title: "Test" }),
      requestContext: {
        ...makeEvent("POST", "/projects").requestContext,
        authorizer: undefined,
      } as unknown as APIGatewayProxyEvent["requestContext"],
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(401);
    expect(result.headers).toMatchObject(expectedCorsHeaders);
  });
});
