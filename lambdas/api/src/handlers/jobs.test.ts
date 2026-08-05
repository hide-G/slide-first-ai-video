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

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handleGetJob } from "./jobs.js";

function makeEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "GET /v1/jobs/{jobId}",
    rawPath: "/v1/jobs/job-001",
    rawQueryString: "",
    headers: {},
    pathParameters: { jobId: "job-001" },
    requestContext: {
      accountId: "123456789",
      apiId: "api-id",
      authorizer: { jwt: { claims: { sub: "user-123" }, scopes: [] } },
      domainName: "api.example.com",
      domainPrefix: "api",
      http: { method: "GET", path: "/v1/jobs/job-001", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "test" },
      requestId: "req-id",
      routeKey: "GET /v1/jobs/{jobId}",
      stage: "$default",
      time: "01/Jan/2024:00:00:00 +0000",
      timeEpoch: 1704067200000,
    },
    body: null,
    isBase64Encoded: false,
    ...overrides,
  } as unknown as APIGatewayProxyEventV2;
}

describe("handleGetJob", () => {
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dynamoModule = await import("@aws-sdk/lib-dynamodb");
    mockSend = (dynamoModule as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
  });

  it("returns job status with stage-specific progress message", async () => {
    mockSend.mockResolvedValue({
      Item: {
        jobId: "job-001",
        projectId: "proj-001",
        userId: "user-123",
        versionNumber: 1,
        type: "GENERATE",
        status: "RUNNING",
        progress: "Generating slide content with AI",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    });

    const event = makeEvent();
    const result = await handleGetJob(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string);
    expect(body.jobId).toBe("job-001");
    expect(body.status).toBe("RUNNING");
    expect(body.progress).toBe("Generating slide content with AI");
  });

  it("returns default progress message for status without custom progress", async () => {
    mockSend.mockResolvedValue({
      Item: {
        jobId: "job-001",
        projectId: "proj-001",
        userId: "user-123",
        versionNumber: 1,
        type: "RENDER",
        status: "PENDING",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    });

    const event = makeEvent();
    const result = await handleGetJob(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string);
    expect(body.progress).toBe("Job queued, waiting to start");
  });

  it("returns 404 if job not found", async () => {
    mockSend.mockResolvedValue({ Item: undefined });

    const event = makeEvent();
    await expect(handleGetJob(event)).rejects.toThrow("Job not found");
  });

  it("returns 403 if user does not own the job", async () => {
    mockSend.mockResolvedValue({
      Item: {
        jobId: "job-001",
        projectId: "proj-001",
        userId: "other-user",
        versionNumber: 1,
        type: "GENERATE",
        status: "RUNNING",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    });

    const event = makeEvent();
    await expect(handleGetJob(event)).rejects.toThrow("Access denied");
  });
});
