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

vi.mock("ulid", () => ({
  ulid: vi.fn(() => "01TESTPROJECTID0001"),
}));

import type { APIGatewayProxyEvent } from "aws-lambda";
import { handleCreateProject, handleListProjects } from "./projects.js";
import { createRestApiEvent } from "../test-utils/rest-api-event.js";

function makeEvent(
  overrides: Partial<APIGatewayProxyEvent> = {},
): APIGatewayProxyEvent {
  return {
    ...createRestApiEvent({
      httpMethod: "POST",
      path: "/v1/projects",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Test Project" }),
    }),
    ...overrides,
  };
}

function makeGetEvent(
  overrides: Partial<APIGatewayProxyEvent> = {},
): APIGatewayProxyEvent {
  return {
    ...createRestApiEvent({
      httpMethod: "GET",
      path: "/v1/projects",
      headers: { "content-type": "application/json" },
    }),
    ...overrides,
  };
}

describe("handleCreateProject", () => {
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dynamoModule = await import("@aws-sdk/lib-dynamodb");
    mockSend = (
      dynamoModule as unknown as { __mockSend: ReturnType<typeof vi.fn> }
    ).__mockSend;
    mockSend.mockResolvedValue({});
  });

  it("creates a project and returns it under the project property", async () => {
    const result = await handleCreateProject(makeEvent());

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.project.projectId).toBe("01TESTPROJECTID0001");
    expect(body.project.title).toBe("Test Project");
    expect(body.project.status).toBe("DRAFT");
    expect(body.project.userId).toBe("user-123");
  });

  it("returns 401 if no auth", async () => {
    const event = makeEvent({
      requestContext: {
        ...makeEvent().requestContext,
        authorizer: undefined,
      } as unknown as APIGatewayProxyEvent["requestContext"],
    });

    await expect(handleCreateProject(event)).rejects.toThrow("Unauthorized");
  });

  it("returns 400 for invalid body", async () => {
    await expect(
      handleCreateProject(makeEvent({ body: JSON.stringify({}) })),
    ).rejects.toThrow("Validation failed");
  });

  it("returns the cached project response for duplicate idempotency key", async () => {
    const { ConditionalCheckFailedException } = await import(
      "@aws-sdk/client-dynamodb"
    );

    const event = makeEvent({
      headers: {
        "content-type": "application/json",
        "idempotency-key": "550e8400-e29b-41d4-a716-446655440000",
      },
    });

    mockSend.mockImplementation(
      (command: { type: string; input?: { Key?: { PK: string } } }) => {
        if (command.type === "Put") {
          throw new ConditionalCheckFailedException({
            message: "Conditional check failed",
            $metadata: {},
          });
        }
        if (command.type === "Get") {
          return {
            Item: {
              idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
              userId: "user-123",
              responseStatus: 201,
              responseBody: JSON.stringify({
                project: {
                  projectId: "existing-id",
                  userId: "user-123",
                  title: "Existing project",
                  status: "DRAFT",
                  createdAt: "2024-01-01T00:00:00.000Z",
                  updatedAt: "2024-01-01T00:00:00.000Z",
                },
              }),
              createdAt: "2024-01-01T00:00:00.000Z",
              ttl: 9999999999,
            },
          };
        }
        return {};
      },
    );

    const result = await handleCreateProject(event);
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.project.projectId).toBe("existing-id");
  });
});

describe("handleListProjects", () => {
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dynamoModule = await import("@aws-sdk/lib-dynamodb");
    mockSend = (
      dynamoModule as unknown as { __mockSend: ReturnType<typeof vi.fn> }
    ).__mockSend;
    mockSend.mockResolvedValue({ Items: [] });
  });

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

    const result = await handleListProjects(makeGetEvent());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0].projectId).toBe("proj-001");
    expect(body.projects[0].title).toBe("My Project");
  });

  it("returns 401 if no auth", async () => {
    const event = makeGetEvent({
      requestContext: {
        ...makeGetEvent().requestContext,
        authorizer: undefined,
      } as unknown as APIGatewayProxyEvent["requestContext"],
    });

    await expect(handleListProjects(event)).rejects.toThrow("Unauthorized");
  });

  it("returns empty array when user has no projects", async () => {
    mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });

    const result = await handleListProjects(makeGetEvent());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.projects).toHaveLength(0);
  });
});
