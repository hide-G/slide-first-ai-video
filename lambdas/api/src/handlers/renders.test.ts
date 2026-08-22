import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEvent } from "aws-lambda";

const mocks = vi.hoisted(() => ({
  getRender: vi.fn(),
  updateRenderStatus: vi.fn(),
  updateProject: vi.fn(),
  verifyProjectOwnership: vi.fn(),
  sfnSend: vi.fn(),
  s3Send: vi.fn(),
  getSignedUrl: vi.fn(),
}));

vi.mock("@aws-sdk/client-sfn", () => ({
  SFNClient: vi.fn(() => ({ send: mocks.sfnSend })),
  StartExecutionCommand: vi.fn((input) => ({ input, type: "StartExecution" })),
  DescribeExecutionCommand: vi.fn((input) => ({ input, type: "DescribeExecution" })),
  GetExecutionHistoryCommand: vi.fn((input) => ({ input, type: "GetExecutionHistory" })),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({ send: mocks.s3Send })),
  ListObjectsV2Command: vi.fn((input) => ({ input, type: "ListObjectsV2" })),
  GetObjectCommand: vi.fn((input) => ({ input, type: "GetObject" })),
  PutObjectCommand: vi.fn((input) => ({ input, type: "PutObject" })),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mocks.getSignedUrl,
}));

vi.mock("../db/index.js", () => ({
  createRender: vi.fn(),
  getRender: mocks.getRender,
  updateRenderStatus: mocks.updateRenderStatus,
  updateProject: mocks.updateProject,
}));

vi.mock("../middleware/index.js", () => ({
  requireAuth: vi.fn(() => "user-123"),
  verifyProjectOwnership: mocks.verifyProjectOwnership,
  validateBody: vi.fn(),
  StartRenderSchema: {},
  buildResponse: (statusCode: number, body: unknown) => ({
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }),
  ApiError: class ApiError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
}));

import { handleGetRenderArtifacts, handleGetRenderStatus } from "./renders.js";

const event = {
  pathParameters: { id: "project-123", renderId: "render-123" },
} as APIGatewayProxyEvent;

const runningRender = {
  renderId: "render-123",
  projectId: "project-123",
  userId: "user-123",
  status: "RUNNING",
  startedAt: "2026-08-15T00:00:00.000Z",
  updatedAt: "2026-08-15T00:00:00.000Z",
  currentStage: "pages",
  executionArn: "arn:aws:states:ap-northeast-1:123456789012:execution:render-pipeline:render-123",
};

function manifestWithProgress() {
  return {
    schemaVersion: 1,
    projectId: "project-123",
    userId: "user-123",
    contentLanguage: "ja-JP",
    source: {
      kind: "uploaded",
      fileKey: "users/user-123/projects/project-123/input/source.pdf",
      fileName: "源内ハンズオン_概要編.pdf",
      pageCount: 3,
    },
    voice: {
      id: "Takumi",
      engine: "neural",
      languageCode: "ja-JP",
      sampleRate: "16000",
    },
    output: {
      aspect: "16:9",
      width: 1920,
      height: 1080,
      fps: 30,
      captions: "burn",
      verticalLayout: null,
      padColor: null,
    },
    lexicon: [],
    pages: [1, 2, 3].map((pageNumber) => ({
      pageNumber,
      imageKey: `pages/page-${String(pageNumber).padStart(3, "0")}.png`,
      script: { mode: "plain", text: `ページ ${pageNumber}` },
      audioKey: `audio/page-${String(pageNumber).padStart(3, "0")}.wav`,
      audioDurationSec: 0,
      frameAlignedDurationMs: 0,
    })),
    stages: {
      pages: "done",
      audio: "running",
      captions: "pending",
      video: "pending",
    },
    progress: {
      stage: "audio",
      currentPage: 1,
      totalPages: 3,
      message: "ページ 1/3 のナレーション音声を生成しました。",
      updatedAt: "2026-08-15T00:01:00.000Z",
    },
  };
}

describe("handleGetRenderStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sfnSend.mockReset();
    mocks.s3Send.mockReset();
    mocks.verifyProjectOwnership.mockResolvedValue({
      projectId: "project-123",
      userId: "user-123",
    });
    mocks.getRender.mockResolvedValue(runningRender);
    mocks.getSignedUrl.mockImplementation((_client: unknown, command: { input: { Key: string } }) =>
      Promise.resolve(`https://download.example/${encodeURIComponent(command.input.Key)}`),
    );
  });

  it("manifest進捗がない場合はStep Functionsの最新タスクを工程として同期する", async () => {
    mocks.sfnSend.mockImplementation((command: { type: string }) => {
      if (command.type === "DescribeExecution") {
        return Promise.resolve({ status: "RUNNING" });
      }
      return Promise.resolve({
        events: [
          {
            type: "TaskStateEntered",
            stateEnteredEventDetails: { name: "CaptionsStage" },
          },
        ],
      });
    });

    const response = await handleGetRenderStatus(event);
    const body = JSON.parse(response.body);

    expect(body).toMatchObject({ status: "RUNNING", currentStage: "captions" });
    expect(mocks.updateRenderStatus).toHaveBeenCalledWith(
      "project-123",
      "render-123",
      "RUNNING",
      expect.objectContaining({ currentStage: "captions" }),
    );
    expect(mocks.updateProject).toHaveBeenCalledWith(
      "user-123",
      "project-123",
      expect.objectContaining({
        status: "RENDERING",
        latestRender: expect.objectContaining({ currentStage: "captions" }),
      }),
    );
  });

  it("manifestのページ進捗をStep Functions履歴より優先して同期する", async () => {
    mocks.sfnSend.mockImplementation((command: { type: string }) => {
      if (command.type === "DescribeExecution") {
        return Promise.resolve({ status: "RUNNING" });
      }
      return Promise.resolve({
        events: [
          {
            type: "TaskStateEntered",
            stateEnteredEventDetails: { name: "CaptionsStage" },
          },
        ],
      });
    });
    mocks.s3Send.mockResolvedValue({
      Body: {
        transformToString: () => Promise.resolve(JSON.stringify(manifestWithProgress())),
      },
    });

    const response = await handleGetRenderStatus(event);
    const body = JSON.parse(response.body);

    expect(body).toMatchObject({
      status: "RUNNING",
      currentStage: "audio",
      progress: {
        stage: "audio",
        currentPage: 1,
        totalPages: 3,
        message: "ページ 1/3 のナレーション音声を生成しました。",
        updatedAt: "2026-08-15T00:01:00.000Z",
      },
    });
    expect(mocks.updateRenderStatus).toHaveBeenCalledWith(
      "project-123",
      "render-123",
      "RUNNING",
      expect.objectContaining({
        currentStage: "audio",
        currentPage: 1,
        totalPages: 3,
        progressMessage: "ページ 1/3 のナレーション音声を生成しました。",
        progressUpdatedAt: "2026-08-15T00:01:00.000Z",
      }),
    );
    expect(mocks.updateProject).toHaveBeenCalledWith(
      "user-123",
      "project-123",
      expect.objectContaining({
        status: "RENDERING",
        latestRender: expect.objectContaining({
          currentStage: "audio",
          currentPage: 1,
          totalPages: 3,
        }),
      }),
    );
  });

  it("失敗理由を外部へ露出せず、終端失敗状態を同期する", async () => {
    mocks.sfnSend.mockResolvedValue({
      status: "FAILED",
      stopDate: new Date("2026-08-15T00:02:00.000Z"),
      error: "States.TaskFailed",
      cause: "内部の詳細情報",
    });

    const response = await handleGetRenderStatus(event);
    const body = JSON.parse(response.body);

    expect(body).toMatchObject({
      status: "FAILED",
      completedAt: "2026-08-15T00:02:00.000Z",
      error: "RENDER_FAILED",
    });
    expect(response.body).not.toContain("内部の詳細情報");
    expect(mocks.updateRenderStatus).toHaveBeenCalledWith(
      "project-123",
      "render-123",
      "FAILED",
      expect.objectContaining({
        completedAt: "2026-08-15T00:02:00.000Z",
        error: "RENDER_FAILED",
      }),
    );
    expect(mocks.updateProject).toHaveBeenCalledWith(
      "user-123",
      "project-123",
      expect.objectContaining({
        status: "RENDER_FAILED",
        latestRender: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });

  it("成功した実行を完了状態へ同期する", async () => {
    mocks.sfnSend.mockResolvedValue({
      status: "SUCCEEDED",
      stopDate: new Date("2026-08-15T00:03:00.000Z"),
    });

    const response = await handleGetRenderStatus(event);
    const body = JSON.parse(response.body);

    expect(body).toMatchObject({
      status: "COMPLETED",
      currentStage: "video",
      completedAt: "2026-08-15T00:03:00.000Z",
    });
    expect(mocks.updateRenderStatus).toHaveBeenCalledWith(
      "project-123",
      "render-123",
      "COMPLETED",
      expect.objectContaining({
        currentStage: "video",
        completedAt: "2026-08-15T00:03:00.000Z",
      }),
    );
    expect(mocks.updateProject).toHaveBeenCalledWith(
      "user-123",
      "project-123",
      expect.objectContaining({
        status: "COMPLETED",
        latestRender: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );
  });
});

describe("handleGetRenderArtifacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.s3Send.mockReset();
    mocks.verifyProjectOwnership.mockResolvedValue({
      projectId: "project-123",
      userId: "user-123",
      title: "予備タイトル",
      source: {
        kind: "uploaded",
        fileKey: "users/user-123/projects/project-123/input/source.pdf",
        fileName: "源内ハンズオン_概要編.pdf",
        pageCount: 3,
      },
    });
    mocks.getRender.mockResolvedValue(runningRender);
    mocks.getSignedUrl.mockImplementation((_client: unknown, command: { input: { Key: string } }) =>
      Promise.resolve(`https://download.example/${encodeURIComponent(command.input.Key)}`),
    );
  });

  it("MP4・SRT・全ページのWAVをPDF名とJST開始時刻のダウンロード名で署名URL付きにする", async () => {
    const projectPrefix = "users/user-123/projects/project-123/";
    const outputPrefix = `${projectPrefix}output/render-123/`;
    const captionsPrefix = `${projectPrefix}captions/`;
    const audioPrefix = `${projectPrefix}audio/`;

    mocks.s3Send.mockImplementation(
      (command: { type: string; input: { Prefix?: string; ContinuationToken?: string } }) => {
        expect(command.type).toBe("ListObjectsV2");

        if (command.input.Prefix === outputPrefix && !command.input.ContinuationToken) {
          return Promise.resolve({
            Contents: [
              { Key: `${outputPrefix}video.mp4`, Size: 100 },
              { Key: `${outputPrefix}job-metadata.json`, Size: 10 },
            ],
            IsTruncated: true,
            NextContinuationToken: "next-output-page",
          });
        }
        if (command.input.Prefix === outputPrefix) {
          return Promise.resolve({
            Contents: [],
            IsTruncated: false,
          });
        }
        if (command.input.Prefix === captionsPrefix) {
          return Promise.resolve({
            Contents: [{ Key: `${captionsPrefix}captions.srt`, Size: 20 }],
            IsTruncated: false,
          });
        }
        if (command.input.Prefix === audioPrefix) {
          return Promise.resolve({
            Contents: [
              { Key: `${audioPrefix}page-001.wav`, Size: 30 },
              { Key: `${audioPrefix}page-002.wav`, Size: 40 },
            ],
            IsTruncated: false,
          });
        }
        throw new Error(`Unexpected prefix: ${command.input.Prefix}`);
      },
    );

    const response = await handleGetRenderArtifacts(event);
    const body = JSON.parse(response.body) as {
      artifacts: Array<{ key: string; url: string; downloadName: string }>;
    };

    expect(body.artifacts.map((artifact) => artifact.key)).toEqual([
      `${audioPrefix}page-001.wav`,
      `${audioPrefix}page-002.wav`,
      `${captionsPrefix}captions.srt`,
      `${outputPrefix}video.mp4`,
    ]);
    expect(body.artifacts.map((artifact) => artifact.downloadName)).toEqual([
      "源内ハンズオン_概要編_20260815-090000_音声.wav",
      "源内ハンズオン_概要編_20260815-090000_音声.wav",
      "源内ハンズオン_概要編_20260815-090000_字幕.srt",
      "源内ハンズオン_概要編_20260815-090000.mp4",
    ]);
    expect(
      body.artifacts.every((artifact) => artifact.url.startsWith("https://download.example/")),
    ).toBe(true);
    expect(mocks.s3Send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ListObjectsV2",
        input: expect.objectContaining({
          Prefix: outputPrefix,
          ContinuationToken: "next-output-page",
        }),
      }),
    );
    expect(mocks.getSignedUrl).toHaveBeenCalledTimes(4);

    const videoCommand = mocks.getSignedUrl.mock.calls
      .map(
        ([, command]) => command as { input: { Key: string; ResponseContentDisposition: string } },
      )
      .find((command) => command.input.Key === `${outputPrefix}video.mp4`);
    const videoDownloadName = "源内ハンズオン_概要編_20260815-090000.mp4";
    expect(videoCommand?.input.ResponseContentDisposition).toBe(
      `attachment; filename="video-download.mp4"; filename*=UTF-8''${encodeURIComponent(videoDownloadName)}`,
    );
  });
});
