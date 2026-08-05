import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock AWS SDK clients
vi.mock("@aws-sdk/client-polly", () => {
  const mockSend = vi.fn();
  return {
    PollyClient: vi.fn(() => ({ send: mockSend })),
    SynthesizeSpeechCommand: vi.fn((input) => ({ input })),
    __mockSend: mockSend,
  };
});

vi.mock("@aws-sdk/client-s3", () => {
  const mockSend = vi.fn();
  return {
    S3Client: vi.fn(() => ({ send: mockSend })),
    PutObjectCommand: vi.fn((input) => ({ input })),
    __mockSend: mockSend,
  };
});

import type { PollyWorkerEvent } from "./index.js";

describe("Polly worker handler", () => {
  let handler: (event: PollyWorkerEvent) => Promise<unknown>;
  let pollyMockSend: ReturnType<typeof vi.fn>;
  let s3MockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get mock references
    const pollyModule = await import("@aws-sdk/client-polly");
    const s3Module = await import("@aws-sdk/client-s3");
    pollyMockSend = (pollyModule as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;

    // Re-import handler to use fresh mocks
    const module = await import("./index.js");
    handler = module.handler;
  });

  const baseEvent: PollyWorkerEvent = {
    projectId: "proj-123",
    userId: "user-456",
    version: 1,
    slideNumber: 1,
    presenterNote: "Hello, this is a test.",
    voiceId: "Mizuki",
    engine: "neural",
    sampleRate: "24000",
    s3Bucket: "test-bucket",
    s3Prefix: "user-456/proj-123/versions/v0001/",
  };

  it("rejects text exceeding 3000 billable characters", async () => {
    const oversizedEvent = {
      ...baseEvent,
      presenterNote: "x".repeat(3001),
    };

    await expect(handler(oversizedEvent)).rejects.toThrow(
      "Text exceeds maximum billable character limit: 3001 > 3000",
    );
  });

  it("accepts text at exactly 3000 characters", async () => {
    // Create 288000 bytes of PCM data (6 seconds at 24000 Hz, 16-bit)
    const pcmBuffer = Buffer.alloc(288000);
    const marksBuffer = Buffer.from(
      '{"time":0,"type":"word","start":0,"end":5,"value":"Hello"}',
    );

    pollyMockSend
      .mockResolvedValueOnce({ AudioStream: pcmBuffer })
      .mockResolvedValueOnce({ AudioStream: marksBuffer });
    s3MockSend.mockResolvedValue({});

    const event = {
      ...baseEvent,
      presenterNote: "x".repeat(3000),
    };

    const result = await handler(event);
    expect(result).toBeDefined();
  });

  it("makes two SynthesizeSpeech calls (pcm + json)", async () => {
    const pcmBuffer = Buffer.alloc(48000); // 1 second of audio
    const marksBuffer = Buffer.from(
      '{"time":0,"type":"word","start":0,"end":5,"value":"Hello"}',
    );

    pollyMockSend
      .mockResolvedValueOnce({ AudioStream: pcmBuffer })
      .mockResolvedValueOnce({ AudioStream: marksBuffer });
    s3MockSend.mockResolvedValue({});

    await handler(baseEvent);

    expect(pollyMockSend).toHaveBeenCalledTimes(2);

    // Verify first call is PCM
    const firstCall = pollyMockSend.mock.calls[0][0];
    expect(firstCall.input.OutputFormat).toBe("pcm");
    expect(firstCall.input.TextType).toBe("ssml");
    expect(firstCall.input.VoiceId).toBe("Mizuki");
    expect(firstCall.input.Engine).toBe("neural");
    expect(firstCall.input.SampleRate).toBe("24000");

    // Verify second call is JSON speech marks
    const secondCall = pollyMockSend.mock.calls[1][0];
    expect(secondCall.input.OutputFormat).toBe("json");
    expect(secondCall.input.SpeechMarkTypes).toEqual(["word", "sentence"]);
  });

  it("calculates measuredAudioMs from PCM byte count", async () => {
    // 288000 bytes at 24000 Hz, 16-bit = 6000 ms
    const pcmBuffer = Buffer.alloc(288000);
    const marksBuffer = Buffer.from("{}");

    pollyMockSend
      .mockResolvedValueOnce({ AudioStream: pcmBuffer })
      .mockResolvedValueOnce({ AudioStream: marksBuffer });
    s3MockSend.mockResolvedValue({});

    const result = await handler(baseEvent);

    // (288000 / 2) / 24000 * 1000 = 6000
    expect(result).toHaveProperty("measuredAudioMs", 6000);
  });

  it("uploads PCM and marks to correct S3 keys", async () => {
    const pcmBuffer = Buffer.alloc(48000);
    const marksBuffer = Buffer.from("{}");

    pollyMockSend
      .mockResolvedValueOnce({ AudioStream: pcmBuffer })
      .mockResolvedValueOnce({ AudioStream: marksBuffer });
    s3MockSend.mockResolvedValue({});

    const result = await handler(baseEvent);

    expect(result).toHaveProperty(
      "voiceKey",
      "user-456/proj-123/versions/v0001/audio/slide-001.pcm",
    );
    expect(result).toHaveProperty(
      "speechMarksKey",
      "user-456/proj-123/versions/v0001/audio/slide-001-marks.json",
    );

    // Verify S3 uploads
    expect(s3MockSend).toHaveBeenCalledTimes(2);

    const firstUpload = s3MockSend.mock.calls[0][0];
    expect(firstUpload.input.Bucket).toBe("test-bucket");
    expect(firstUpload.input.Key).toBe(
      "user-456/proj-123/versions/v0001/audio/slide-001.pcm",
    );
    expect(firstUpload.input.ContentType).toBe("audio/pcm");

    const secondUpload = s3MockSend.mock.calls[1][0];
    expect(secondUpload.input.Key).toBe(
      "user-456/proj-123/versions/v0001/audio/slide-001-marks.json",
    );
    expect(secondUpload.input.ContentType).toBe("application/json");
  });

  it("returns correct slide number", async () => {
    const pcmBuffer = Buffer.alloc(48000);
    const marksBuffer = Buffer.from("{}");

    pollyMockSend
      .mockResolvedValueOnce({ AudioStream: pcmBuffer })
      .mockResolvedValueOnce({ AudioStream: marksBuffer });
    s3MockSend.mockResolvedValue({});

    const event = { ...baseEvent, slideNumber: 5 };
    const result = await handler(event);

    expect(result).toHaveProperty("slideNumber", 5);
    expect(result).toHaveProperty(
      "voiceKey",
      "user-456/proj-123/versions/v0001/audio/slide-005.pcm",
    );
  });
});
