import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@aws-sdk/client-mediaconvert", () => {
  const mockSend = vi.fn();
  return {
    MediaConvertClient: vi.fn(() => ({ send: mockSend })),
    CreateJobCommand: vi.fn((input) => ({ input })),
    GetJobCommand: vi.fn((input) => ({ input })),
    DescribeEndpointsCommand: vi.fn((input) => ({ input, type: "DescribeEndpoints" })),
    __mockSend: mockSend,
  };
});

vi.mock("@aws-sdk/client-s3", () => {
  const mockSend = vi.fn();
  return {
    S3Client: vi.fn(() => ({ send: mockSend })),
    GetObjectCommand: vi.fn((input) => ({ input, type: "GetObject" })),
    PutObjectCommand: vi.fn((input) => ({ input, type: "PutObject" })),
    __mockSend: mockSend,
  };
});

import type { VideoEvent } from "./index.js";
import { handler, _resetEndpointCache } from "./index.js";

function makeManifest(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    projectId: "proj-001",
    userId: "user-001",
    contentLanguage: "ja-JP",
    source: { kind: "uploaded", fileKey: "input/source.pdf", pageCount: 2 },
    voice: { id: "Mizuki", engine: "neural", languageCode: "ja-JP", sampleRate: "16000" },
    output: { aspect: "16:9", width: 1920, height: 1080, fps: 30, captions: "burn", verticalLayout: null, padColor: null },
    lexicon: [],
    pages: [
      { pageNumber: 1, imageKey: "pages/page-001.png", script: { mode: "plain", text: "Hello" }, audioKey: "audio/page-001.wav", audioDurationSec: 2.5, frameAlignedDurationMs: 2534 },
      { pageNumber: 2, imageKey: "pages/page-002.png", script: { mode: "plain", text: "World" }, audioKey: "audio/page-002.wav", audioDurationSec: 3.0, frameAlignedDurationMs: 3034 },
    ],
    stages: { pages: "done", audio: "done", captions: "done", video: "pending" },
    cost: {
      currency: "USD",
      priceListFetchedAt: "2024-01-01T00:00:00.000Z",
      stages: [
        { stage: "audio", service: "polly", usage: { characterCount: 100 }, estimatedCost: 0.0004 },
      ],
      estimatedTotal: 0.0004,
      actual: { status: "pending", amount: null, reconciledAt: null },
    },
    ...overrides,
  };
}

describe("mediaconvert-worker handler", () => {
  let mockMcSend: ReturnType<typeof vi.fn>;
  let mockS3Send: ReturnType<typeof vi.fn>;

  const baseEvent: VideoEvent = {
    s3Bucket: "my-bucket",
    s3Prefix: "users/user-001/projects/proj-001/",
    projectId: "proj-001",
    userId: "user-001",
    renderId: "render-001",
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Speed up polling by making setTimeout resolve immediately
    vi.useFakeTimers();

    // Reset endpoint cache between tests
    _resetEndpointCache();

    // Set MEDIACONVERT_ENDPOINT env var to skip DescribeEndpoints call in tests
    process.env.MEDIACONVERT_ENDPOINT = "https://mediaconvert.ap-northeast-1.amazonaws.com";

    const mcModule = await import("@aws-sdk/client-mediaconvert");
    mockMcSend = (mcModule as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;

    const s3Module = await import("@aws-sdk/client-s3");
    mockS3Send = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.MEDIACONVERT_ENDPOINT;
  });

  it("adds mediaconvert cost entry to manifest after job completion", async () => {
    const manifest = makeManifest();

    // Mock S3 GetObject (read manifest)
    mockS3Send.mockResolvedValueOnce({
      Body: { transformToString: async () => JSON.stringify(manifest) },
    });
    // Mock S3 PutObject (update manifest - stage running)
    mockS3Send.mockResolvedValueOnce({});

    // Mock MediaConvert CreateJob
    mockMcSend.mockResolvedValueOnce({
      Job: { Id: "job-123" },
    });

    // Mock MediaConvert GetJob (COMPLETE with duration)
    mockMcSend.mockResolvedValueOnce({
      Job: {
        Status: "COMPLETE",
        OutputGroupDetails: [
          { OutputDetails: [{ DurationInMs: 5568 }] },
        ],
      },
    });

    // Mock S3 PutObject (final manifest write)
    mockS3Send.mockResolvedValueOnce({});

    // Run handler with advancing timers
    const resultPromise = handler(baseEvent);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(result.outputDurationMs).toBe(5568);

    // Verify the final PutObject call wrote a manifest with cost entry
    const putCalls = mockS3Send.mock.calls;
    // The last S3 call should be the final manifest write
    const lastPutCall = putCalls[putCalls.length - 1][0];
    const writtenManifest = JSON.parse(lastPutCall.input.Body);

    expect(writtenManifest.cost.stages).toHaveLength(2);
    expect(writtenManifest.cost.stages[1]).toEqual({
      stage: "video",
      service: "mediaconvert",
      usage: {
        outputDurationSec: 5.568,
        outputResolution: "1920x1080",
      },
      estimatedCost: 0.0,
    });
  });

  it("initializes cost object if manifest has no cost field", async () => {
    const manifest = makeManifest({ cost: undefined });

    // Mock S3 GetObject (read manifest)
    mockS3Send.mockResolvedValueOnce({
      Body: { transformToString: async () => JSON.stringify(manifest) },
    });
    // Mock S3 PutObject (update manifest - stage running)
    mockS3Send.mockResolvedValueOnce({});

    // Mock MediaConvert CreateJob
    mockMcSend.mockResolvedValueOnce({
      Job: { Id: "job-456" },
    });

    // Mock MediaConvert GetJob (COMPLETE)
    mockMcSend.mockResolvedValueOnce({
      Job: {
        Status: "COMPLETE",
        OutputGroupDetails: [
          { OutputDetails: [{ DurationInMs: 10000 }] },
        ],
      },
    });

    // Mock S3 PutObject (final manifest write)
    mockS3Send.mockResolvedValueOnce({});

    const resultPromise = handler(baseEvent);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.success).toBe(true);

    // Verify cost was initialized
    const putCalls = mockS3Send.mock.calls;
    const lastPutCall = putCalls[putCalls.length - 1][0];
    const writtenManifest = JSON.parse(lastPutCall.input.Body);

    expect(writtenManifest.cost).toBeDefined();
    expect(writtenManifest.cost.currency).toBe("USD");
    expect(writtenManifest.cost.stages).toHaveLength(1);
    expect(writtenManifest.cost.stages[0].stage).toBe("video");
    expect(writtenManifest.cost.stages[0].service).toBe("mediaconvert");
    expect(writtenManifest.cost.stages[0].usage.outputDurationSec).toBe(10);
    expect(writtenManifest.cost.stages[0].usage.outputResolution).toBe("1920x1080");
    expect(writtenManifest.cost.stages[0].estimatedCost).toBe(0.0);
  });

  it("preserves existing polly cost entry when adding mediaconvert entry", async () => {
    const manifest = makeManifest();

    mockS3Send.mockResolvedValueOnce({
      Body: { transformToString: async () => JSON.stringify(manifest) },
    });
    mockS3Send.mockResolvedValueOnce({});

    mockMcSend.mockResolvedValueOnce({
      Job: { Id: "job-789" },
    });

    mockMcSend.mockResolvedValueOnce({
      Job: {
        Status: "COMPLETE",
        OutputGroupDetails: [
          { OutputDetails: [{ DurationInMs: 3000 }] },
        ],
      },
    });

    mockS3Send.mockResolvedValueOnce({});

    const resultPromise = handler(baseEvent);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.success).toBe(true);

    const putCalls = mockS3Send.mock.calls;
    const lastPutCall = putCalls[putCalls.length - 1][0];
    const writtenManifest = JSON.parse(lastPutCall.input.Body);

    // Polly entry should still be there
    expect(writtenManifest.cost.stages[0]).toEqual({
      stage: "audio",
      service: "polly",
      usage: { characterCount: 100 },
      estimatedCost: 0.0004,
    });
    // MediaConvert entry should be appended
    expect(writtenManifest.cost.stages[1].stage).toBe("video");
    expect(writtenManifest.cost.stages[1].service).toBe("mediaconvert");
  });

  it("throws error when polling exhausts MAX_POLL_ATTEMPTS without terminal status", async () => {
    const manifest = makeManifest();

    // Mock S3 GetObject (read manifest)
    mockS3Send.mockResolvedValueOnce({
      Body: { transformToString: async () => JSON.stringify(manifest) },
    });
    // Mock S3 PutObject (update manifest - stage running)
    mockS3Send.mockResolvedValueOnce({});

    // Mock MediaConvert CreateJob
    mockMcSend.mockResolvedValueOnce({
      Job: { Id: "job-stuck" },
    });

    // Mock MediaConvert GetJob - always returns PROGRESSING (never reaches terminal)
    mockMcSend.mockResolvedValue({
      Job: { Status: "PROGRESSING" },
    });

    // Mock S3 PutObject (manifest write for failed state)
    mockS3Send.mockResolvedValue({});

    const resultPromise = handler(baseEvent);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.error).toContain("did not reach terminal status");
    expect(result.error).toContain("job-stuck");

    // Verify that the manifest was written with "failed" stage
    const putCalls = mockS3Send.mock.calls;
    const lastPutCall = putCalls[putCalls.length - 1][0];
    const writtenManifest = JSON.parse(lastPutCall.input.Body);
    expect(writtenManifest.stages.video).toBe("failed");
  });

  it("resolves endpoint via DescribeEndpoints when env var is not set", async () => {
    // Remove env var and reset cache to trigger DescribeEndpoints path
    delete process.env.MEDIACONVERT_ENDPOINT;
    _resetEndpointCache();

    const manifest = makeManifest();

    // Mock S3 GetObject (read manifest)
    mockS3Send.mockResolvedValueOnce({
      Body: { transformToString: async () => JSON.stringify(manifest) },
    });
    // Mock S3 PutObject (update manifest - stage running)
    mockS3Send.mockResolvedValueOnce({});

    // Mock DescribeEndpoints response
    mockMcSend.mockResolvedValueOnce({
      Endpoints: [{ Url: "https://abcdefg.mediaconvert.ap-northeast-1.amazonaws.com" }],
    });

    // Mock MediaConvert CreateJob
    mockMcSend.mockResolvedValueOnce({
      Job: { Id: "job-endpoint-test" },
    });

    // Mock MediaConvert GetJob (COMPLETE)
    mockMcSend.mockResolvedValueOnce({
      Job: {
        Status: "COMPLETE",
        OutputGroupDetails: [
          { OutputDetails: [{ DurationInMs: 4000 }] },
        ],
      },
    });

    // Mock S3 PutObject (final manifest write)
    mockS3Send.mockResolvedValueOnce({});

    const resultPromise = handler(baseEvent);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(result.outputDurationMs).toBe(4000);
  });
});
