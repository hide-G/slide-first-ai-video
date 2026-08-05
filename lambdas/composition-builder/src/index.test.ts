import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock AWS SDK
vi.mock("@aws-sdk/client-s3", () => {
  const mockSend = vi.fn().mockResolvedValue({});
  return {
    S3Client: vi.fn(() => ({ send: mockSend })),
    PutObjectCommand: vi.fn((input) => ({ input })),
    __mockSend: mockSend,
  };
});

import type { VideoManifest, OutputConfig } from "@slide-first/shared-types";
import type { CompositionBuilderEvent } from "./index.js";

describe("Composition builder handler", () => {
  let handler: (event: CompositionBuilderEvent) => Promise<unknown>;
  let s3MockSend: ReturnType<typeof vi.fn>;

  const sampleOutput: OutputConfig = {
    compositionId: "lt-full-16x9",
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrateKbps: 5000,
  };

  const sampleManifest: VideoManifest = {
    schemaVersion: "1.0",
    deckId: "deck-001",
    deckVersion: 1,
    locale: "ja",
    voice: {
      voiceId: "Mizuki",
      engine: "neural",
      sampleRate: "24000",
    },
    outputs: {
      "lt-full-16x9": sampleOutput,
    },
    captions: {
      styleId: "default",
      maxCharsPerLine: 40,
      maxLines: 2,
      minDurationMs: 500,
      captionsKey: "captions/captions.json",
      vttKey: "captions/full.ja.vtt",
      srtKey: "captions/full.ja.srt",
    },
    slides: [
      {
        slideNumber: 1,
        imageKey: "slides/deck.001.png",
        imageSha256: "abc123",
        presenterNote: "Welcome to the presentation",
        teaserNote: "Welcome",
        keyPoints: ["introduction"],
        voiceKey: "audio/slide-001.pcm",
        speechMarksKey: "audio/slide-001-marks.json",
        measuredAudioMs: 3000,
        leadInMs: 500,
        leadOutMs: 500,
        durationMs: 4000,
        startMs: 0,
        transition: "fade",
        importance: "HIGH",
        includeInXTeaser: true,
      },
      {
        slideNumber: 2,
        imageKey: "slides/deck.002.png",
        imageSha256: "def456",
        presenterNote: "Second slide content here",
        teaserNote: "Second",
        keyPoints: ["content"],
        voiceKey: "audio/slide-002.pcm",
        speechMarksKey: "audio/slide-002-marks.json",
        measuredAudioMs: 5000,
        leadInMs: 300,
        leadOutMs: 700,
        durationMs: 6000,
        startMs: 4000,
        transition: "slide",
        importance: "MEDIUM",
        includeInXTeaser: false,
      },
    ],
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const s3Module = await import("@aws-sdk/client-s3");
    s3MockSend = (s3Module as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;

    const module = await import("./index.js");
    handler = module.handler;
  });

  const baseEvent: CompositionBuilderEvent = {
    manifest: sampleManifest,
    s3Bucket: "test-bucket",
    s3Prefix: "user-456/proj-123/versions/v0001/",
    assetsPrefix: "https://cdn.example.com/",
    outputId: "lt-full-16x9",
  };

  it("generates HTML and uploads to S3", async () => {
    const result = await handler(baseEvent) as {
      compositionKey: string;
      assetsManifest: { images: string[]; audio: string[]; totalSlides: number; totalDurationMs: number };
    };

    expect(result.compositionKey).toBe(
      "user-456/proj-123/versions/v0001/composition/lt-full-16x9/index.html",
    );
    expect(s3MockSend).toHaveBeenCalledTimes(1);

    const uploadCall = s3MockSend.mock.calls[0][0];
    expect(uploadCall.input.Bucket).toBe("test-bucket");
    expect(uploadCall.input.Key).toBe(
      "user-456/proj-123/versions/v0001/composition/lt-full-16x9/index.html",
    );
    expect(uploadCall.input.ContentType).toBe("text/html; charset=utf-8");
  });

  it("returns correct assets manifest", async () => {
    const result = await handler(baseEvent) as {
      compositionKey: string;
      assetsManifest: { images: string[]; audio: string[]; totalSlides: number; totalDurationMs: number };
    };

    expect(result.assetsManifest.images).toEqual([
      "slides/deck.001.png",
      "slides/deck.002.png",
    ]);
    expect(result.assetsManifest.audio).toEqual([
      "audio/slide-001.pcm",
      "audio/slide-002.pcm",
    ]);
    expect(result.assetsManifest.totalSlides).toBe(2);
    expect(result.assetsManifest.totalDurationMs).toBe(10000); // 4000 + 6000
  });

  it("throws error for unknown output ID", async () => {
    const event = { ...baseEvent, outputId: "non-existent" };
    await expect(handler(event)).rejects.toThrow(
      "Output configuration 'non-existent' not found in manifest",
    );
  });

  it("generates HTML with correct timing attributes", async () => {
    await handler(baseEvent);

    const uploadCall = s3MockSend.mock.calls[0][0];
    const html = uploadCall.input.Body as string;

    // Verify HTML structure
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('data-composition-id="lt-full-16x9"');
    expect(html).toContain('data-width="1920"');
    expect(html).toContain('data-height="1080"');
    expect(html).toContain('data-fps="30"');

    // Verify slide timing
    expect(html).toContain('data-start="0.000"');
    expect(html).toContain('data-start="4.000"');
  });
});
