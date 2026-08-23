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

    const s3Module = await import("@aws-sdk/client-s3");
    const mockS3Send = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    mockS3Send.mockReset();
    mockS3Send.mockResolvedValue({});

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

  it("routes PUT /projects/{id}/output (save caption style settings)", async () => {
    mockDynamoSend.mockResolvedValueOnce({
      Item: { projectId: "proj-001", userId: "user-123", status: "DRAFT" },
    });
    mockDynamoSend.mockResolvedValueOnce({});

    const event = makeEvent("PUT", "/projects/proj-001/output", {
      body: JSON.stringify({
        aspect: "9:16",
        width: 1080,
        height: 1920,
        fps: 30,
        captions: "burn",
        verticalLayout: "top",
        padColor: "white",
        captionStyle: "chalkboard",
        captionPlacement: "safe-area",
      }),
    });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.output).toMatchObject({
      aspect: "9:16",
      captionStyle: "chalkboard",
      captionPlacement: "safe-area",
    });

    const updateCall = mockDynamoSend.mock.calls
      .map((call) => call[0])
      .find((command) => command?.type === "Update");
    expect(updateCall.input.ExpressionAttributeValues[":output"]).toMatchObject({
      captionStyle: "chalkboard",
      captionPlacement: "safe-area",
    });
  });

  it("rejects a safe-area caption outside vertical top layout", async () => {
    mockDynamoSend.mockResolvedValueOnce({
      Item: { projectId: "proj-001", userId: "user-123", status: "DRAFT" },
    });

    const event = makeEvent("PUT", "/projects/proj-001/output", {
      body: JSON.stringify({
        aspect: "16:9",
        width: 1920,
        height: 1080,
        fps: 30,
        captions: "burn",
        verticalLayout: null,
        padColor: null,
        captionStyle: "white-outline",
        captionPlacement: "safe-area",
      }),
    });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe("VALIDATION_ERROR");
  });

  it.each(["srt", "none"] as const)(
    "rejects caption decoration for %s output",
    async (captions) => {
      mockDynamoSend.mockResolvedValueOnce({
        Item: { projectId: "proj-001", userId: "user-123", status: "DRAFT" },
      });

      const event = makeEvent("PUT", "/projects/proj-001/output", {
        body: JSON.stringify({
          aspect: "9:16",
          width: 1080,
          height: 1920,
          fps: 30,
          captions,
          verticalLayout: "top",
          padColor: "white",
          captionStyle: "chalkboard",
          captionPlacement: "safe-area",
        }),
      });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toBe("VALIDATION_ERROR");
      expect(mockDynamoSend.mock.calls.some((call) => call[0]?.type === "Update")).toBe(false);
    },
  );

  it("rejects runtime-only captionSafeAreaYPosition in the save API", async () => {
    mockDynamoSend.mockResolvedValueOnce({
      Item: { projectId: "proj-001", userId: "user-123", status: "DRAFT" },
    });

    const event = makeEvent("PUT", "/projects/proj-001/output", {
      body: JSON.stringify({
        aspect: "9:16",
        width: 1080,
        height: 1920,
        fps: 30,
        captions: "burn",
        verticalLayout: "top",
        padColor: "white",
        captionStyle: "chalkboard",
        captionPlacement: "safe-area",
        captionSafeAreaYPosition: 1182,
      }),
    });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe("VALIDATION_ERROR");
    expect(mockDynamoSend.mock.calls.some((call) => call[0]?.type === "Update")).toBe(false);
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
      output: {
        aspect: "9:16",
        fps: 30,
        captions: "burn",
        verticalLayout: "top",
        padColor: "white",
        captionStyle: "chalkboard",
        captionPlacement: "safe-area",
      },
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
    expect(manifest.output).toMatchObject({
      aspect: "9:16",
      width: 1080,
      height: 1920,
      captionStyle: "chalkboard",
      captionPlacement: "safe-area",
    });
  });

  it("部分再実行では互換な既存manifestからsafe-areaと音声尺を引き継ぐ", async () => {
    const readyProject = {
      projectId: "proj-001",
      userId: "user-123",
      status: "COMPLETED",
      contentLanguage: "ja-JP",
      source: {
        kind: "uploaded",
        fileKey: "users/user-123/projects/proj-001/input/source.pdf",
        pageCount: 1,
      },
      output: {
        aspect: "9:16",
        fps: 30,
        captions: "burn",
        narrationMode: "spoken",
        silentPageDurationSec: 5,
        verticalLayout: "top",
        padColor: "navy",
        captionStyle: "chalkboard",
        captionPlacement: "safe-area",
      },
      narration: [{ pageNumber: 1, mode: "plain", text: "1ページ目の原稿です。" }],
      voice: {
        id: "Takumi",
        engine: "neural",
        languageCode: "ja-JP",
        sampleRate: "16000",
      },
      lexicon: [],
    };
    const previousManifest = {
      schemaVersion: 1,
      projectId: "proj-001",
      userId: "user-123",
      contentLanguage: "ja-JP",
      source: readyProject.source,
      voice: readyProject.voice,
      output: {
        aspect: "9:16",
        width: 1080,
        height: 1920,
        fps: 30,
        captions: "burn",
        narrationMode: "spoken",
        silentPageDurationSec: 5,
        verticalLayout: "top",
        padColor: "navy",
        captionStyle: "chalkboard",
        captionPlacement: "safe-area",
        captionSafeAreaYPosition: 1182,
      },
      lexicon: [],
      pages: [
        {
          pageNumber: 1,
          imageKey: "users/user-123/projects/proj-001/pages/page-001.png",
          script: { mode: "plain", text: "1ページ目の原稿です。" },
          audioKey: "users/user-123/projects/proj-001/audio/page-001.wav",
          audioDurationSec: 4.2,
          frameAlignedDurationMs: 4233,
        },
      ],
      stages: { pages: "done", audio: "done", captions: "done", video: "done" },
    };

    mockDynamoSend.mockResolvedValueOnce({ Item: readyProject });
    const s3Module = await import("@aws-sdk/client-s3");
    const s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    s3MockSend.mockResolvedValueOnce({
      Body: { transformToString: async () => JSON.stringify(previousManifest) },
    });

    const event = makeEvent("POST", "/projects/proj-001/renders", {
      body: JSON.stringify({ startFromStage: "video" }),
    });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(201);
    const manifestPut = s3MockSend.mock.calls
      .map((call: unknown[]) => call[0] as { input?: { Body?: string } })
      .find((command) => typeof command.input?.Body === "string");
    const manifest = JSON.parse(manifestPut?.input?.Body ?? "{}");
    expect(manifest.output.captionSafeAreaYPosition).toBe(1182);
    expect(manifest.pages[0]).toMatchObject({
      audioDurationSec: 4.2,
      frameAlignedDurationMs: 4233,
    });
    expect(manifest.stages).toEqual({
      pages: "done",
      audio: "done",
      captions: "done",
      video: "pending",
    });

    const startExecution = mockSfnSend.mock.calls
      .map((call) => call[0] as { input?: { input?: string; type?: string } })
      .find((command) => command.type === "StartExecution");
    expect(JSON.parse(startExecution?.input?.input ?? "{}")).toMatchObject({
      startFromStage: "video",
    });
  });

  it("不適格な部分再実行ではmanifestを上書きせずpagesからの開始を要求する", async () => {
    const readyProject = {
      projectId: "proj-001",
      userId: "user-123",
      status: "COMPLETED",
      source: {
        kind: "uploaded",
        fileKey: "users/user-123/projects/proj-001/input/source.pdf",
        pageCount: 1,
      },
      output: { aspect: "9:16", fps: 30, captions: "burn", verticalLayout: "top" },
      narration: [{ pageNumber: 1, mode: "plain", text: "1ページ目の原稿です。" }],
      lexicon: [],
    };
    mockDynamoSend.mockResolvedValueOnce({ Item: readyProject });
    const s3Module = await import("@aws-sdk/client-s3");
    const s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    s3MockSend.mockRejectedValueOnce(
      Object.assign(new Error("manifest not found"), {
        name: "NoSuchKey",
        $metadata: { httpStatusCode: 404 },
      }),
    );

    const event = makeEvent("POST", "/projects/proj-001/renders", {
      body: JSON.stringify({ startFromStage: "video" }),
    });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body).error).toBe("PARTIAL_RENDER_REQUIRES_PAGES");
    expect(s3MockSend.mock.calls).toHaveLength(1);
    expect(mockSfnSend).not.toHaveBeenCalled();
  });

  function makePartialRenderProject() {
    return {
      projectId: "proj-001",
      userId: "user-123",
      status: "COMPLETED",
      contentLanguage: "ja-JP",
      source: {
        kind: "uploaded",
        fileKey: "users/user-123/projects/proj-001/input/source.pdf",
        pageCount: 1,
      },
      output: { aspect: "9:16", fps: 30, captions: "burn", verticalLayout: "top" },
      narration: [{ pageNumber: 1, mode: "plain", text: "1ページ目の原稿です。" }],
      lexicon: [],
    };
  }

  function makeCompletedPartialManifest(
    project: ReturnType<typeof makePartialRenderProject>,
    captions: "burn" | "srt" | "none" = "burn",
  ) {
    const keyPrefix = `users/${project.userId}/projects/${project.projectId}`;
    return {
      schemaVersion: 1,
      projectId: project.projectId,
      userId: project.userId,
      contentLanguage: project.contentLanguage,
      source: project.source,
      voice: { id: "Takumi", engine: "neural", languageCode: "ja-JP", sampleRate: "16000" },
      output: {
        aspect: "9:16",
        width: 1080,
        height: 1920,
        fps: 30,
        captions,
        narrationMode: "spoken",
        silentPageDurationSec: 5,
        verticalLayout: "top",
        padColor: null,
        captionStyle: captions === "burn" ? "white-outline" : null,
        captionPlacement: captions === "burn" ? "bottom" : null,
        captionSafeAreaYPosition: null,
      },
      lexicon: [],
      pages: Array.from({ length: project.source.pageCount }, (_, index) => {
        const pageNumber = index + 1;
        return {
          pageNumber,
          imageKey: `${keyPrefix}/pages/page-${String(pageNumber).padStart(3, "0")}.png`,
          script: { mode: "plain", text: project.narration[index]?.text ?? "" },
          audioKey: `${keyPrefix}/audio/page-${String(pageNumber).padStart(3, "0")}.wav`,
          audioDurationSec: 4.2,
          frameAlignedDurationMs: 4233,
        };
      }),
      stages: { pages: "done", audio: "done", captions: "done", video: "done" },
    };
  }

  function mockPartialRenderS3(
    s3MockSend: ReturnType<typeof vi.fn>,
    previousManifest: ReturnType<typeof makeCompletedPartialManifest>,
    failingArtifact?: { key: string; error: unknown },
  ): void {
    s3MockSend.mockImplementation(
      (command: { type?: string; input?: { Key?: string; Body?: unknown } }) => {
        if (command.type === "Head") {
          if (command.input?.Key === failingArtifact?.key) {
            return Promise.reject(failingArtifact.error);
          }
          return {};
        }

        if (command.input?.Body !== undefined) {
          return {};
        }

        return { Body: { transformToString: async () => JSON.stringify(previousManifest) } };
      },
    );
  }

  function headObjectKeys(s3MockSend: ReturnType<typeof vi.fn>): string[] {
    return s3MockSend.mock.calls
      .map((call: unknown[]) => call[0] as { type?: string; input?: { Key?: string } })
      .filter((command) => command.type === "Head")
      .map((command) => command.input?.Key)
      .filter((key): key is string => typeof key === "string");
  }

  function manifestWasWritten(s3MockSend: ReturnType<typeof vi.fn>): boolean {
    return s3MockSend.mock.calls
      .map((call: unknown[]) => call[0] as { input?: { Key?: string; Body?: unknown } })
      .some(
        (command) =>
          command.input?.Key?.endsWith("manifest.json") && command.input.Body !== undefined,
      );
  }

  it("audioからの部分再実行は全ページのPNGだけを確認する", async () => {
    const readyProject = makePartialRenderProject();
    const previousManifest = makeCompletedPartialManifest(readyProject);
    mockDynamoSend.mockResolvedValueOnce({ Item: readyProject });

    const s3Module = await import("@aws-sdk/client-s3");
    const s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    mockPartialRenderS3(s3MockSend, previousManifest);

    const result = await handler(
      makeEvent("POST", "/projects/proj-001/renders", {
        body: JSON.stringify({ startFromStage: "audio" }),
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(201);
    expect(headObjectKeys(s3MockSend)).toEqual([
      "users/user-123/projects/proj-001/pages/page-001.png",
    ]);
  });

  it("captionsからの部分再実行はPNGとWAVを確認する", async () => {
    const readyProject = makePartialRenderProject();
    const previousManifest = makeCompletedPartialManifest(readyProject);
    mockDynamoSend.mockResolvedValueOnce({ Item: readyProject });

    const s3Module = await import("@aws-sdk/client-s3");
    const s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    mockPartialRenderS3(s3MockSend, previousManifest);

    const result = await handler(
      makeEvent("POST", "/projects/proj-001/renders", {
        body: JSON.stringify({ startFromStage: "captions" }),
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(201);
    expect(headObjectKeys(s3MockSend)).toEqual([
      "users/user-123/projects/proj-001/pages/page-001.png",
      "users/user-123/projects/proj-001/audio/page-001.wav",
    ]);
  });

  it("captionsがsrtのvideo部分再実行はSRTを前提にしない", async () => {
    const readyProject = makePartialRenderProject();
    readyProject.output.captions = "srt";
    const previousManifest = makeCompletedPartialManifest(readyProject, "srt");
    mockDynamoSend.mockResolvedValueOnce({ Item: readyProject });

    const s3Module = await import("@aws-sdk/client-s3");
    const s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    mockPartialRenderS3(s3MockSend, previousManifest);

    const result = await handler(
      makeEvent("POST", "/projects/proj-001/renders", {
        body: JSON.stringify({ startFromStage: "video" }),
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(201);
    expect(headObjectKeys(s3MockSend)).toEqual([
      "users/user-123/projects/proj-001/pages/page-001.png",
      "users/user-123/projects/proj-001/audio/page-001.wav",
    ]);
  });

  it("焼き込み字幕のvideo部分再実行は全体SRTとページ別SRTを確認する", async () => {
    const readyProject = makePartialRenderProject();
    readyProject.source.pageCount = 2;
    readyProject.narration.push({ pageNumber: 2, mode: "plain", text: "2ページ目の原稿です。" });
    const previousManifest = makeCompletedPartialManifest(readyProject);
    mockDynamoSend.mockResolvedValueOnce({ Item: readyProject });

    const s3Module = await import("@aws-sdk/client-s3");
    const s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    mockPartialRenderS3(s3MockSend, previousManifest);

    const result = await handler(
      makeEvent("POST", "/projects/proj-001/renders", {
        body: JSON.stringify({ startFromStage: "video" }),
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(201);
    expect(headObjectKeys(s3MockSend)).toEqual([
      "users/user-123/projects/proj-001/pages/page-001.png",
      "users/user-123/projects/proj-001/pages/page-002.png",
      "users/user-123/projects/proj-001/audio/page-001.wav",
      "users/user-123/projects/proj-001/audio/page-002.wav",
      "users/user-123/projects/proj-001/captions/captions.srt",
      "users/user-123/projects/proj-001/captions/pages/page-001.srt",
      "users/user-123/projects/proj-001/captions/pages/page-002.srt",
    ]);
  });

  it("再利用するページ別焼き込み字幕SRTが欠損するとmanifestを上書きせずpagesからの開始を要求する", async () => {
    const readyProject = makePartialRenderProject();
    readyProject.source.pageCount = 2;
    readyProject.narration.push({ pageNumber: 2, mode: "plain", text: "2ページ目の原稿です。" });
    const previousManifest = makeCompletedPartialManifest(readyProject);
    const pageSrtKey = "users/user-123/projects/proj-001/captions/pages/page-002.srt";
    mockDynamoSend.mockResolvedValueOnce({ Item: readyProject });

    const s3Module = await import("@aws-sdk/client-s3");
    const s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    mockPartialRenderS3(s3MockSend, previousManifest, {
      key: pageSrtKey,
      error: Object.assign(new Error("caption not found"), {
        name: "NoSuchKey",
        $metadata: { httpStatusCode: 404 },
      }),
    });

    const result = await handler(
      makeEvent("POST", "/projects/proj-001/renders", {
        body: JSON.stringify({ startFromStage: "video" }),
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body).error).toBe("PARTIAL_RENDER_REQUIRES_PAGES");
    expect(headObjectKeys(s3MockSend)).toEqual([
      "users/user-123/projects/proj-001/pages/page-001.png",
      "users/user-123/projects/proj-001/pages/page-002.png",
      "users/user-123/projects/proj-001/audio/page-001.wav",
      "users/user-123/projects/proj-001/audio/page-002.wav",
      "users/user-123/projects/proj-001/captions/captions.srt",
      "users/user-123/projects/proj-001/captions/pages/page-001.srt",
      pageSrtKey,
    ]);
    expect(manifestWasWritten(s3MockSend)).toBe(false);
    expect(mockSfnSend).not.toHaveBeenCalled();
  });

  it("再利用する全体焼き込み字幕SRTが欠損するとmanifestを上書きせずpagesからの開始を要求する", async () => {
    const readyProject = makePartialRenderProject();
    const previousManifest = makeCompletedPartialManifest(readyProject);
    const srtKey = "users/user-123/projects/proj-001/captions/captions.srt";
    mockDynamoSend.mockResolvedValueOnce({ Item: readyProject });

    const s3Module = await import("@aws-sdk/client-s3");
    const s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    mockPartialRenderS3(s3MockSend, previousManifest, {
      key: srtKey,
      error: Object.assign(new Error("caption not found"), {
        name: "NoSuchKey",
        $metadata: { httpStatusCode: 404 },
      }),
    });

    const result = await handler(
      makeEvent("POST", "/projects/proj-001/renders", {
        body: JSON.stringify({ startFromStage: "video" }),
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body).error).toBe("PARTIAL_RENDER_REQUIRES_PAGES");
    expect(headObjectKeys(s3MockSend)).toEqual([
      "users/user-123/projects/proj-001/pages/page-001.png",
      "users/user-123/projects/proj-001/audio/page-001.wav",
      srtKey,
      "users/user-123/projects/proj-001/captions/pages/page-001.srt",
    ]);
    expect(manifestWasWritten(s3MockSend)).toBe(false);
    expect(mockSfnSend).not.toHaveBeenCalled();
  });

  it.each([
    {
      description: "アクセス拒否を500で返す",
      s3Error: Object.assign(new Error("access denied"), {
        name: "AccessDenied",
        $metadata: { httpStatusCode: 403 },
      }),
      statusCode: 500,
      errorCode: "PARTIAL_RENDER_ARTIFACT_ACCESS_DENIED",
    },
    {
      description: "一時的な障害を503で返す",
      s3Error: Object.assign(new Error("service unavailable"), {
        name: "ServiceUnavailable",
        $metadata: { httpStatusCode: 503 },
      }),
      statusCode: 503,
      errorCode: "PARTIAL_RENDER_ARTIFACT_CHECK_UNAVAILABLE",
    },
    {
      description: "存在しないバケットを502で返す",
      s3Error: Object.assign(new Error("bucket not found"), {
        name: "NoSuchBucket",
        $metadata: { httpStatusCode: 404 },
      }),
      statusCode: 502,
      errorCode: "PARTIAL_RENDER_ARTIFACT_CHECK_FAILED",
    },
    {
      description: "その他の障害を502で返す",
      s3Error: Object.assign(new Error("unexpected error"), {
        name: "InternalError",
        $metadata: { httpStatusCode: 400 },
      }),
      statusCode: 502,
      errorCode: "PARTIAL_RENDER_ARTIFACT_CHECK_FAILED",
    },
  ])("再利用成果物の確認で$description", async ({ s3Error, statusCode, errorCode }) => {
    const readyProject = makePartialRenderProject();
    const previousManifest = makeCompletedPartialManifest(readyProject);
    const imageKey = "users/user-123/projects/proj-001/pages/page-001.png";
    mockDynamoSend.mockResolvedValueOnce({ Item: readyProject });

    const s3Module = await import("@aws-sdk/client-s3");
    const s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    mockPartialRenderS3(s3MockSend, previousManifest, { key: imageKey, error: s3Error });

    const result = await handler(
      makeEvent("POST", "/projects/proj-001/renders", {
        body: JSON.stringify({ startFromStage: "video" }),
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(statusCode);
    expect(JSON.parse(result.body).error).toBe(errorCode);
    expect(manifestWasWritten(s3MockSend)).toBe(false);
    expect(mockSfnSend).not.toHaveBeenCalled();
  });

  it("字幕設定がない旧manifestからvideoを部分再実行できる", async () => {
    const readyProject = makePartialRenderProject();
    const legacyManifest = {
      schemaVersion: 1,
      projectId: "proj-001",
      userId: "user-123",
      contentLanguage: "ja-JP",
      source: readyProject.source,
      voice: { id: "Takumi", engine: "neural", languageCode: "ja-JP", sampleRate: "16000" },
      output: {
        aspect: "9:16",
        width: 1080,
        height: 1920,
        fps: 30,
        captions: "burn",
        narrationMode: "spoken",
        silentPageDurationSec: 5,
        verticalLayout: "top",
        padColor: null,
      },
      lexicon: [],
      pages: [
        {
          pageNumber: 1,
          imageKey: "users/user-123/projects/proj-001/pages/page-001.png",
          script: { mode: "plain", text: "1ページ目の原稿です。" },
          audioKey: "users/user-123/projects/proj-001/audio/page-001.wav",
          audioDurationSec: 4.2,
          frameAlignedDurationMs: 4233,
        },
      ],
      stages: { pages: "done", audio: "done", captions: "done", video: "done" },
    };

    mockDynamoSend.mockResolvedValueOnce({ Item: readyProject });
    const s3Module = await import("@aws-sdk/client-s3");
    const s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    s3MockSend.mockResolvedValueOnce({
      Body: { transformToString: async () => JSON.stringify(legacyManifest) },
    });

    const result = await handler(
      makeEvent("POST", "/projects/proj-001/renders", {
        body: JSON.stringify({ startFromStage: "video" }),
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(201);
    const manifestPut = s3MockSend.mock.calls
      .map((call: unknown[]) => call[0] as { input?: { Body?: string } })
      .find((command) => typeof command.input?.Body === "string");
    expect(JSON.parse(manifestPut?.input?.Body ?? "{}")).toMatchObject({
      output: { captionStyle: "white-outline", captionPlacement: "bottom" },
      stages: { pages: "done", audio: "done", captions: "done", video: "pending" },
    });
  });

  it.each([
    {
      description: "AccessDenied を500で返す",
      s3Error: Object.assign(new Error("access denied"), {
        name: "AccessDenied",
        $metadata: { httpStatusCode: 403 },
      }),
      statusCode: 500,
      errorCode: "MANIFEST_READ_ACCESS_DENIED",
    },
    {
      description: "一時的なS3障害を503で返す",
      s3Error: Object.assign(new Error("service unavailable"), {
        name: "ServiceUnavailable",
        $metadata: { httpStatusCode: 503 },
      }),
      statusCode: 503,
      errorCode: "MANIFEST_READ_UNAVAILABLE",
    },
    {
      description: "存在しないバケットを502で返す",
      s3Error: Object.assign(new Error("bucket not found"), {
        name: "NoSuchBucket",
        $metadata: { httpStatusCode: 404 },
      }),
      statusCode: 502,
      errorCode: "MANIFEST_READ_FAILED",
    },
  ])("部分再実行で$description", async ({ s3Error, statusCode, errorCode }) => {
    mockDynamoSend.mockResolvedValueOnce({ Item: makePartialRenderProject() });
    const s3Module = await import("@aws-sdk/client-s3");
    const s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    s3MockSend.mockRejectedValueOnce(s3Error);

    const result = await handler(
      makeEvent("POST", "/projects/proj-001/renders", {
        body: JSON.stringify({ startFromStage: "video" }),
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(statusCode);
    expect(JSON.parse(result.body).error).toBe(errorCode);
    expect(s3MockSend).toHaveBeenCalledTimes(1);
    expect(mockSfnSend).not.toHaveBeenCalled();
  });

  it("壊れた既存manifestは409でpagesからの開始を要求する", async () => {
    mockDynamoSend.mockResolvedValueOnce({ Item: makePartialRenderProject() });
    const s3Module = await import("@aws-sdk/client-s3");
    const s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    s3MockSend.mockResolvedValueOnce({ Body: { transformToString: async () => "{" } });

    const result = await handler(
      makeEvent("POST", "/projects/proj-001/renders", {
        body: JSON.stringify({ startFromStage: "video" }),
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body).error).toBe("PARTIAL_RENDER_REQUIRES_PAGES");
    expect(mockSfnSend).not.toHaveBeenCalled();
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

  it("失敗時はStep Functions履歴から失敗工程を保存して返す", async () => {
    mockDynamoSend
      .mockResolvedValueOnce({
        Item: { projectId: "proj-001", userId: "user-123", status: "RENDERING" },
      })
      .mockResolvedValueOnce({
        Item: {
          renderId: "render-001",
          projectId: "proj-001",
          userId: "user-123",
          status: "RUNNING",
          executionArn: "arn:aws:states:us-east-1:123:execution:test",
          currentStage: "pages",
          currentPage: 0,
          totalPages: 1,
          progressMessage: "PDFページを画像に変換しています。",
          progressUpdatedAt: "2026-08-15T00:00:00.000Z",
          startedAt: "2026-08-15T00:00:00.000Z",
          updatedAt: "2026-08-15T00:00:00.000Z",
        },
      });
    mockSfnSend
      .mockResolvedValueOnce({ status: "FAILED", stopDate: new Date("2026-08-15T00:01:00.000Z") })
      .mockResolvedValueOnce({
        events: [
          {
            type: "TaskStateEntered",
            stateEnteredEventDetails: { name: "AudioStage" },
          },
        ],
      });

    const result = await handler(
      makeEvent("GET", "/projects/proj-001/renders/render-001"),
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ status: "FAILED", currentStage: "audio" });
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
      .mockResolvedValueOnce({
        Contents: [
          {
            Key: "users/user-123/projects/proj-001/captions/captions.srt",
            Size: 120,
            LastModified: new Date("2024-01-01"),
          },
          {
            Key: "users/user-123/projects/proj-001/captions/pages/page-001.srt",
            Size: 42,
            LastModified: new Date("2024-01-01"),
          },
        ],
      })
      .mockResolvedValueOnce({ Contents: [] });

    const event = makeEvent("GET", "/projects/proj-001/renders/render-001/artifacts");
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.artifacts).toHaveLength(2);
    expect(body.artifacts.map((artifact: { key: string }) => artifact.key)).toEqual([
      "users/user-123/projects/proj-001/captions/captions.srt",
      "users/user-123/projects/proj-001/output/render-001/video.mp4",
    ]);
    expect(
      body.artifacts.some((artifact: { key: string }) => artifact.key.includes("/captions/pages/")),
    ).toBe(false);
    const videoArtifact = body.artifacts.find((artifact: { key: string }) =>
      artifact.key.endsWith("/video.mp4"),
    );
    expect(videoArtifact).toMatchObject({
      url: "https://presigned.example.com",
      downloadName: "源内ハンズオン_概要編_20240101-090000.mp4",
    });
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
