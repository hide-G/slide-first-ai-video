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
    PutObjectCommand: vi.fn((input) => ({ input })),
    HeadObjectCommand: vi.fn((input) => ({ input, type: "Head" })),
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
    StartExecutionCommand: vi.fn((input) => ({ input, type: "StartExecution" })),
    DescribeExecutionCommand: vi.fn((input) => ({ input, type: "DescribeExecution" })),
    GetExecutionHistoryCommand: vi.fn((input) => ({ input, type: "GetExecutionHistory" })),
    __mockSend: mockSend,
  };
});

vi.mock("@aws-sdk/client-lambda", () => {
  const mockSend = vi.fn();
  return {
    LambdaClient: vi.fn(() => ({ send: mockSend })),
    InvokeCommand: vi.fn((input) => ({ input })),
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
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,Idempotency-Key",
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
  let mockDynamoSend: ReturnType<typeof vi.fn>;
  let mockSfnSend: ReturnType<typeof vi.fn>;
  let mockLambdaSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dynamoModule = await import("@aws-sdk/lib-dynamodb");
    mockDynamoSend = (dynamoModule as unknown as { __mockSend: ReturnType<typeof vi.fn> })
      .__mockSend;
    mockDynamoSend.mockResolvedValue({ Items: [] });

    const sfnModule = await import("@aws-sdk/client-sfn");
    mockSfnSend = (sfnModule as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    mockSfnSend.mockResolvedValue({ executionArn: "arn:aws:states:us-east-1:123:execution:test" });

    const lambdaModule = await import("@aws-sdk/client-lambda");
    mockLambdaSend = (lambdaModule as unknown as { __mockSend: ReturnType<typeof vi.fn> })
      .__mockSend;
    mockLambdaSend.mockResolvedValue({
      Payload: Buffer.from(JSON.stringify({ outline: [] })),
    });
  });

  it("returns CORS headers with 404 for unknown routes", async () => {
    const event = makeEvent("GET", "/v1/unknown");
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(404);
    expect(result.headers).toMatchObject(expectedCorsHeaders);
    const body = JSON.parse(result.body);
    expect(body.error).toBe("NOT_FOUND");
  });

  it("routes GET /projects (list user projects)", async () => {
    const event = makeEvent("GET", "/v1/projects");
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toMatchObject(expectedCorsHeaders);
    const body = JSON.parse(result.body);
    expect(body.projects).toEqual([]);
  });

  it("routes POST /projects (create project with kind)", async () => {
    const event = makeEvent("POST", "/projects", {
      body: JSON.stringify({ title: "Router Test", kind: "video" }),
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(201);
    expect(result.headers).toMatchObject(expectedCorsHeaders);
    const body = JSON.parse(result.body);
    expect(body.project.projectId).toBe("01TESTROUTERID00001");
    expect(body.project.title).toBe("Router Test");
    expect(body.project.kind).toBe("video");
  });

  it("routes POST /projects/{id}/outline (generate outline)", async () => {
    // First mock: getProjectByUser (via GetCommand) returns project owned by user
    mockDynamoSend.mockResolvedValueOnce({
      Item: { projectId: "proj-001", userId: "user-123", status: "DRAFT" },
    });
    // Second mock: Lambda invoke for outline generation
    mockLambdaSend.mockResolvedValueOnce({
      Payload: Buffer.from(JSON.stringify({ outline: [{ pageNumber: 1, title: "Intro" }] })),
    });
    // Third mock: updateProject
    mockDynamoSend.mockResolvedValueOnce({});

    const event = makeEvent("POST", "/projects/proj-001/outline", {
      body: JSON.stringify({ topic: "AI Video Creation" }),
    });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.outline).toEqual([{ pageNumber: 1, title: "Intro" }]);
  });

  it("routes PUT /projects/{id}/outline (save outline)", async () => {
    mockDynamoSend.mockResolvedValueOnce({
      Item: { projectId: "proj-001", userId: "user-123", status: "OUTLINE_GENERATED" },
    });
    mockDynamoSend.mockResolvedValueOnce({});

    const event = makeEvent("PUT", "/projects/proj-001/outline", {
      body: JSON.stringify({ outline: [{ pageNumber: 1, title: "Saved", bullets: [] }] }),
    });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
  });

  it("routes POST /projects/{id}/source-upload-url (presigned URL)", async () => {
    mockDynamoSend.mockResolvedValueOnce({
      Item: { projectId: "proj-001", userId: "user-123", status: "DRAFT" },
    });

    const event = makeEvent("POST", "/projects/proj-001/source-upload-url", {
      body: JSON.stringify({ fileName: "slides.pdf", contentType: "application/pdf" }),
    });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.uploadUrl).toBe("https://presigned.example.com");
    expect(body.fileKey).toContain("source.pdf");
  });

  it("routes POST /projects/{id}/source (register source)", async () => {
    mockDynamoSend.mockResolvedValueOnce({
      Item: { projectId: "proj-001", userId: "user-123", status: "DRAFT" },
    });

    // Mock S3 HeadObject for size validation
    const s3Module = await import("@aws-sdk/client-s3");
    const s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    s3MockSend.mockResolvedValueOnce({ ContentLength: 5000000 }); // 5MB file

    // ページ数はクライアント値ではなく、marp-render Lambdaのpdf.js計測結果を使う
    mockLambdaSend.mockResolvedValueOnce({
      Payload: Buffer.from(JSON.stringify({ success: true, pageCount: 3 })),
    });
    mockDynamoSend.mockResolvedValueOnce({});

    const event = makeEvent("POST", "/projects/proj-001/source", {
      body: JSON.stringify({
        kind: "uploaded",
        fileKey: "users/user-123/projects/proj-001/input/source.pdf",
        fileName: "../源内ハンズオン_概要編.pdf",
        pageCount: 10,
      }),
    });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.source.kind).toBe("uploaded");
    expect(body.source.pageCount).toBe(3);
    expect(body.source.fileName).toBe("源内ハンズオン_概要編.pdf");
  });

  it("rejects non-PDF files in POST /projects/{id}/source with PDF_REQUIRED", async () => {
    mockDynamoSend.mockResolvedValueOnce({
      Item: { projectId: "proj-001", userId: "user-123", status: "DRAFT" },
    });

    const event = makeEvent("POST", "/projects/proj-001/source", {
      body: JSON.stringify({
        kind: "uploaded",
        fileKey: "users/user-123/projects/proj-001/input/source.pptx",
      }),
    });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe("PDF_REQUIRED");
    expect(body.message).toContain("PDF");
  });

  it("rejects non-PDF files in POST /projects/{id}/source-upload-url with PDF_REQUIRED", async () => {
    mockDynamoSend.mockResolvedValueOnce({
      Item: { projectId: "proj-001", userId: "user-123", status: "DRAFT" },
    });

    const event = makeEvent("POST", "/projects/proj-001/source-upload-url", {
      body: JSON.stringify({
        fileName: "slides.pptx",
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      }),
    });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe("PDF_REQUIRED");
    expect(body.message).toContain("PDF");
  });

  it("routes PUT /projects/{id}/output (save output settings)", async () => {
    mockDynamoSend.mockResolvedValueOnce({
      Item: { projectId: "proj-001", userId: "user-123", status: "DRAFT" },
    });
    mockDynamoSend.mockResolvedValueOnce({});

    const event = makeEvent("PUT", "/projects/proj-001/output", {
      body: JSON.stringify({
        aspect: "16:9",
        width: 1920,
        height: 1080,
        fps: 30,
        captions: "burn",
      }),
    });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.output.aspect).toBe("16:9");
  });

  it("saves narration without an explicit voice", async () => {
    // voice は任意項目。undefined を UpdateExpression に含めると
    // "expression attribute value ... is not defined" で 500 になっていた。
    mockDynamoSend.mockResolvedValueOnce({
      Item: { projectId: "proj-001", userId: "user-123", status: "DRAFT" },
    });
    mockDynamoSend.mockResolvedValueOnce({});

    const event = makeEvent("PUT", "/projects/proj-001/narration", {
      body: JSON.stringify({
        scripts: [{ pageNumber: 1, mode: "plain", text: "一ページ目です。" }],
      }),
    });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);

    const updateCall = mockDynamoSend.mock.calls
      .map((call) => call[0])
      .find((command) => command?.type === "Update");
    expect(updateCall).toBeDefined();
    expect(updateCall.input.UpdateExpression).not.toContain(":voice");
    expect(updateCall.input.ExpressionAttributeValues).not.toHaveProperty(":voice");
  });

  it("routes POST /projects/{id}/renders (start render)", async () => {
    // レンダリング開始前に manifest.json をS3へ書き出すため、
    // source と narration が揃ったプロジェクトを2回返す（所有者確認と manifest 組み立て）
    const readyProject = {
      projectId: "proj-001",
      userId: "user-123",
      status: "NARRATION_CONFIRMED",
      contentLanguage: "ja-JP",
      source: {
        kind: "uploaded",
        fileKey: "users/user-123/projects/proj-001/input/source.pdf",
        fileName: "源内ハンズオン_概要編.pdf",
        pageCount: 2,
      },
      output: { aspect: "16:9", fps: 30, captions: "burn" },
      narration: [
        { pageNumber: 1, mode: "plain", text: "1ページ目の原稿です。" },
        { pageNumber: 2, mode: "plain", text: "2ページ目の原稿です。" },
      ],
      lexicon: [],
    };

    mockDynamoSend.mockResolvedValueOnce({ Item: readyProject });
    mockDynamoSend.mockResolvedValueOnce({});

    const event = makeEvent("POST", "/projects/proj-001/renders", {
      body: JSON.stringify({}),
    });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.renderId).toBe("01TESTROUTERID00001");
    expect(body.status).toBe("RUNNING");

    const s3Module = await import("@aws-sdk/client-s3");
    const s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    const manifestPut = s3MockSend.mock.calls
      .map((call: unknown[]) => call[0] as { input?: { Key?: string; Body?: string } })
      .find((command) => command.input?.Key?.endsWith("manifest.json"));
    const manifest = JSON.parse(manifestPut?.input?.Body ?? "{}");
    expect(manifest.source.fileName).toBe("源内ハンズオン_概要編.pdf");
    expect(manifest.progress).toMatchObject({
      stage: "pages",
      currentPage: 0,
      totalPages: 2,
    });
  });

  it("rejects starting a render when narration is missing", async () => {
    const incompleteProject = {
      projectId: "proj-001",
      userId: "user-123",
      status: "OUTPUT_CONFIGURED",
      source: {
        kind: "uploaded",
        fileKey: "users/user-123/projects/proj-001/input/source.pdf",
        pageCount: 2,
      },
      // narration が無い状態
    };

    mockDynamoSend.mockResolvedValueOnce({ Item: incompleteProject });

    const event = makeEvent("POST", "/projects/proj-001/renders", {
      body: JSON.stringify({}),
    });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe("NARRATION_REQUIRED");
  });

  it("routes GET /projects/{id}/renders/{renderId} (render status)", async () => {
    mockDynamoSend.mockResolvedValueOnce({
      Item: { projectId: "proj-001", userId: "user-123", status: "NARRATION_CONFIRMED" },
    });
    mockDynamoSend.mockResolvedValueOnce({
      Item: {
        renderId: "render-001",
        projectId: "proj-001",
        userId: "user-123",
        status: "RUNNING",
        currentStage: "audio",
        currentPage: 1,
        totalPages: 3,
        progressMessage: "ページ 1/3 のナレーション音声を生成しました。",
        progressUpdatedAt: "2024-01-01T00:01:00.000Z",
        startedAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:01:00.000Z",
      },
    });

    const event = makeEvent("GET", "/projects/proj-001/renders/render-001");
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.renderId).toBe("render-001");
    expect(body.status).toBe("RUNNING");
    expect(body.progress).toMatchObject({
      stage: "audio",
      currentPage: 1,
      totalPages: 3,
      message: "ページ 1/3 のナレーション音声を生成しました。",
    });
  });

  it("routes GET /projects/{id}/renders/{renderId}/artifacts", async () => {
    mockDynamoSend.mockResolvedValueOnce({
      Item: {
        projectId: "proj-001",
        userId: "user-123",
        title: "予備タイトル",
        status: "DONE",
        source: {
          kind: "uploaded",
          fileKey: "users/user-123/projects/proj-001/input/source.pdf",
          fileName: "源内ハンズオン_概要編.pdf",
          pageCount: 2,
        },
      },
    });
    mockDynamoSend.mockResolvedValueOnce({
      Item: {
        renderId: "render-001",
        projectId: "proj-001",
        userId: "user-123",
        status: "COMPLETED",
        startedAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:05:00.000Z",
      },
    });

    const s3Module = await import("@aws-sdk/client-s3");
    const s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    s3MockSend
      .mockResolvedValueOnce({
        Contents: [
          {
            Key: "users/user-123/projects/proj-001/output/render-001/video.mp4",
            Size: 1024000,
            LastModified: new Date("2024-01-01"),
          },
        ],
      })
      .mockResolvedValueOnce({ Contents: [] })
      .mockResolvedValueOnce({ Contents: [] });

    const event = makeEvent("GET", "/projects/proj-001/renders/render-001/artifacts");
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.artifacts).toHaveLength(1);
    expect(body.artifacts[0].url).toBe("https://presigned.example.com");
    expect(body.artifacts[0].downloadName).toBe("源内ハンズオン_概要編_20240101-090000.mp4");
  });

  it("returns 401 for unauthenticated requests", async () => {
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

  it("returns 403 for project owned by another user", async () => {
    // With GetItem on PK=USER#{userId}, SK=PROJECT#{projectId},
    // a project owned by another user simply won't be found
    mockDynamoSend.mockResolvedValueOnce({
      Item: undefined,
    });

    const event = makeEvent("PUT", "/projects/proj-001/outline", {
      body: JSON.stringify({ outline: [{ pageNumber: 1, title: "Test" }] }),
    });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(403);
    expect(result.headers).toMatchObject(expectedCorsHeaders);
  });

  it("returns 403 when project does not exist", async () => {
    mockDynamoSend.mockResolvedValueOnce({ Item: undefined });

    const event = makeEvent("PUT", "/projects/nonexistent/output", {
      body: JSON.stringify({
        aspect: "16:9",
        width: 1920,
        height: 1080,
        fps: 30,
        captions: "burn",
      }),
    });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(403);
  });

  it("handles all 11+ endpoint paths correctly", async () => {
    // Verify all routes are registered by checking known paths don't 404
    const routePaths = [
      { method: "GET", path: "/projects" },
      { method: "POST", path: "/projects" },
      { method: "POST", path: "/projects/x/outline" },
      { method: "PUT", path: "/projects/x/outline" },
      { method: "POST", path: "/projects/x/deck" },
      { method: "POST", path: "/projects/x/source-upload-url" },
      { method: "POST", path: "/projects/x/source" },
      { method: "PUT", path: "/projects/x/output" },
      { method: "POST", path: "/projects/x/narration" },
      { method: "PUT", path: "/projects/x/narration" },
      { method: "POST", path: "/projects/x/renders" },
      { method: "GET", path: "/projects/x/renders/r1" },
      { method: "GET", path: "/projects/x/renders/r1/artifacts" },
    ];

    for (const { method, path } of routePaths) {
      // Reset mocks for ownership check (GetCommand returns no Item -> 403)
      mockDynamoSend.mockResolvedValue({ Items: [], Item: undefined });
      const event = makeEvent(method, path, {
        body: JSON.stringify({}),
      });
      const result = await handler(event, mockContext);
      // Should NOT be 404 (may be 401, 403, or other but never 404)
      expect(result.statusCode).not.toBe(404);
    }
  });
});
