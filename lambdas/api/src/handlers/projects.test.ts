import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock AWS SDK and dependencies
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

vi.mock("ulid", () => ({
  ulid: vi.fn(() => "01TESTPROJECTID0001"),
}));

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handleCreateProject, handleListProjects } from "./projects.js";

function makeEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "POST /v1/projects",
    rawPath: "/v1/projects",
    rawQueryString: "",
    headers: { "content-type": "application/json" },
    requestContext: {
      accountId: "123456789",
      apiId: "api-id",
      authorizer: {
        jwt: { claims: { sub: "user-123" }, scopes: [] },
      },
      domainName: "api.example.com",
      domainPrefix: "api",
      http: { method: "POST", path: "/v1/projects", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "test" },
      requestId: "req-id",
      routeKey: "POST /v1/projects",
      stage: "$default",
      time: "01/Jan/2024:00:00:00 +0000",
      timeEpoch: 1704067200000,
    },
    body: JSON.stringify({ title: "Test Project" }),
    isBase64Encoded: false,
    ...overrides,
  } as unknown as APIGatewayProxyEventV2;
}

describe("handleCreateProject", () => {
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dynamoModule = await import("@aws-sdk/lib-dynamodb");
    mockSend = (dynamoModule as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    mockSend.mockResolvedValue({});
  });

  it("creates a project and returns 201", async () => {
    const event = makeEvent();
    const result = await handleCreateProject(event);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body as string);
    expect(body.projectId).toBe("01TESTPROJECTID0001");
    expect(body.title).toBe("Test Project");
    expect(body.status).toBe("DRAFT");
    expect(body.userId).toBe("user-123");
  });

  it("returns 401 if no auth", async () => {
    const event = makeEvent({
      requestContext: {
        ...makeEvent().requestContext,
        authorizer: undefined,
      } as unknown as APIGatewayProxyEventV2["requestContext"],
    });

    await expect(handleCreateProject(event)).rejects.toThrow("Unauthorized");
  });

  it("returns 400 for invalid body", async () => {
    const event = makeEvent({ body: JSON.stringify({}) });

    await expect(handleCreateProject(event)).rejects.toThrow("Validation failed");
  });

  it("returns cached response for duplicate idempotency key", async () => {
    const { ConditionalCheckFailedException } = await import("@aws-sdk/client-dynamodb");

    const event = makeEvent({
      headers: {
        "content-type": "application/json",
        "idempotency-key": "550e8400-e29b-41d4-a716-446655440000",
      },
    });

    // Mock: idempotency putIfAbsent returns existing record
    mockSend.mockImplementation((cmd: { type: string; input?: { Key?: { PK: string } } }) => {
      if (cmd.type === "Put") {
        throw new ConditionalCheckFailedException({ message: "Conditional check failed", $metadata: {} });
      }
      if (cmd.type === "Get") {
        return {
          Item: {
            idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
            userId: "user-123",
            responseStatus: 201,
            responseBody: JSON.stringify({ projectId: "existing-id" }),
            createdAt: "2024-01-01T00:00:00.000Z",
            ttl: 9999999999,
          },
        };
      }
      return {};
    });

    const result = await handleCreateProject(event);
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body as string);
    expect(body.projectId).toBe("existing-id");
  });
});

describe("handleListProjects", () => {
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dynamoModule = await import("@aws-sdk/lib-dynamodb");
    mockSend = (dynamoModule as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    mockSend.mockResolvedValue({ Items: [] });
  });

  function makeGetEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
    return {
      version: "2.0",
      routeKey: "GET /v1/projects",
      rawPath: "/v1/projects",
      rawQueryString: "",
      headers: { "content-type": "application/json" },
      queryStringParameters: undefined,
      requestContext: {
        accountId: "123456789",
        apiId: "api-id",
        authorizer: {
          jwt: { claims: { sub: "user-123" }, scopes: [] },
        },
        domainName: "api.example.com",
        domainPrefix: "api",
        http: { method: "GET", path: "/v1/projects", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "test" },
        requestId: "req-id",
        routeKey: "GET /v1/projects",
        stage: "$default",
        time: "01/Jan/2024:00:00:00 +0000",
        timeEpoch: 1704067200000,
      },
      body: undefined,
      isBase64Encoded: false,
      ...overrides,
    } as unknown as APIGatewayProxyEventV2;
  }

  it("returns 200 with projects list", async () => {
    mockSend.mockResolvedValue({
      Items: [
        {
          projectId: "proj-001",
          userId: "user-123",
          title: "My Project",
          status: "DRAFT",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
      LastEvaluatedKey: undefined,
    });

    const event = makeGetEvent();
    const result = await handleListProjects(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string);
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0].projectId).toBe("proj-001");
    expect(body.projects[0].title).toBe("My Project");
  });

  it("returns 401 if no auth", async () => {
    const event = makeGetEvent({
      requestContext: {
        ...makeGetEvent().requestContext,
        authorizer: undefined,
      } as unknown as APIGatewayProxyEventV2["requestContext"],
    });

    await expect(handleListProjects(event)).rejects.toThrow("Unauthorized");
  });

  it("returns empty array when user has no projects", async () => {
    mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });

    const event = makeGetEvent();
    const result = await handleListProjects(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string);
    expect(body.projects).toHaveLength(0);
  });
});
