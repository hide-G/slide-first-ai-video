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
    ListObjectsV2Command: vi.fn((input) => ({ input, type: "ListObjectsV2" })),
    GetObjectCommand: vi.fn((input) => ({ input, type: "GetObject" })),
    __mockSend: mockSend,
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => "https://presigned-url.example.com/file"),
}));

import type { APIGatewayProxyEvent } from "aws-lambda";
import { handleGetDeliverables } from "./deliverables.js";
import { createRestApiEvent } from "../test-utils/rest-api-event.js";

function makeEvent(
  overrides: Partial<APIGatewayProxyEvent> = {},
): APIGatewayProxyEvent {
  return {
    ...createRestApiEvent({
      httpMethod: "GET",
      path: "/v1/projects/proj-001/deliverables",
      pathParameters: { id: "proj-001" },
    }),
    ...overrides,
  };
}

describe("handleGetDeliverables", () => {
  let dynamoMockSend: ReturnType<typeof vi.fn>;
  let s3MockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dynamoModule = await import("@aws-sdk/lib-dynamodb");
    dynamoMockSend = (dynamoModule as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;

    const s3Module = await import("@aws-sdk/client-s3");
    s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
  });

  it("returns presigned URLs for available artifacts", async () => {
    dynamoMockSend.mockResolvedValue({
      Item: {
        projectId: "proj-001",
        userId: "user-123",
        title: "Test",
        status: "ASSET_BUILDING",
        currentVersion: 1,
      },
    });

    s3MockSend.mockResolvedValue({
      Contents: [
        {
          Key: "user-123/proj-001/versions/v0001/output/video.mp4",
          Size: 5242880,
          LastModified: new Date("2024-01-02T00:00:00.000Z"),
        },
        {
          Key: "user-123/proj-001/versions/v0001/captions/full.ja.vtt",
          Size: 1024,
          LastModified: new Date("2024-01-02T00:00:00.000Z"),
        },
        {
          Key: "user-123/proj-001/versions/v0001/captions/full.ja.srt",
          Size: 1024,
          LastModified: new Date("2024-01-02T00:00:00.000Z"),
        },
        {
          Key: "user-123/proj-001/versions/v0001/slides/deck.001.png",
          Size: 2048,
          LastModified: new Date("2024-01-02T00:00:00.000Z"),
        },
      ],
    });

    const event = makeEvent();
    const result = await handleGetDeliverables(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string);
    expect(body.deliverables).toHaveLength(3);
    expect(body.deliverables[0].type).toBe("mp4");
    expect(body.deliverables[0].url).toBe("https://presigned-url.example.com/file");
    expect(body.deliverables[1].type).toBe("vtt");
    expect(body.deliverables[2].type).toBe("srt");
  });

  it("returns empty array when no version exists", async () => {
    dynamoMockSend.mockResolvedValue({
      Item: {
        projectId: "proj-001",
        userId: "user-123",
        title: "Test",
        status: "DRAFT",
        currentVersion: 0,
      },
    });

    const event = makeEvent();
    const result = await handleGetDeliverables(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string);
    expect(body.deliverables).toHaveLength(0);
  });

  it("returns 403 for unauthorized access", async () => {
    dynamoMockSend.mockResolvedValue({
      Item: {
        projectId: "proj-001",
        userId: "other-user",
        title: "Test",
        status: "ASSET_BUILDING",
        currentVersion: 1,
      },
    });

    const event = makeEvent();
    await expect(handleGetDeliverables(event)).rejects.toThrow("Access denied");
  });
});
