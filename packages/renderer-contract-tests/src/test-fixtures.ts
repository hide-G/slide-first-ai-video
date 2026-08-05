import type { VideoManifest } from "@slide-first/shared-types";
import type { RenderInput } from "@slide-first/renderer-port";

/**
 * Create a test manifest with configurable slides.
 */
export function createTestManifest(
  options: {
    slideCount?: number;
    slideDurationMs?: number;
    fps?: number;
    width?: number;
    height?: number;
  } = {},
): VideoManifest {
  const {
    slideCount = 3,
    slideDurationMs = 5000,
    fps = 30,
    width = 1920,
    height = 1080,
  } = options;

  const slides = Array.from({ length: slideCount }, (_, i) => ({
    slideNumber: i + 1,
    imageKey: `decks/deck-1/v1/slides/slide-${i + 1}.png`,
    imageSha256: `sha256-slide-${i + 1}`,
    presenterNote: `Speaker note for slide ${i + 1}`,
    teaserNote: `Teaser for slide ${i + 1}`,
    keyPoints: [`Point ${i + 1}a`, `Point ${i + 1}b`],
    voiceKey: `decks/deck-1/v1/audio/slide-${i + 1}.pcm`,
    speechMarksKey: `decks/deck-1/v1/speech-marks/slide-${i + 1}.json`,
    measuredAudioMs: slideDurationMs - 1000,
    leadInMs: 500,
    leadOutMs: 500,
    durationMs: slideDurationMs,
    startMs: i * slideDurationMs,
    transition: "fade" as const,
    importance: "HIGH" as const,
    includeInXTeaser: true,
  }));

  return {
    schemaVersion: "1.0",
    deckId: "deck-1",
    deckVersion: 1,
    locale: "en-US",
    voice: {
      voiceId: "Matthew",
      engine: "neural",
      sampleRate: "24000",
    },
    outputs: {
      "lt-full": {
        compositionId: "lt-full",
        width,
        height,
        fps,
        videoBitrateKbps: 5000,
      },
    },
    captions: {
      styleId: "default",
      maxCharsPerLine: 42,
      maxLines: 2,
      minDurationMs: 1000,
      captionsKey: "decks/deck-1/v1/captions/captions.json",
      vttKey: "decks/deck-1/v1/captions/captions.vtt",
      srtKey: "decks/deck-1/v1/captions/captions.srt",
    },
    slides,
  };
}

/**
 * Create a standard RenderInput for testing.
 */
export function createTestRenderInput(
  overrides: Partial<RenderInput> = {},
): RenderInput {
  return {
    manifestKey: "decks/deck-1/v1/manifest.json",
    bucket: "test-bucket",
    outputType: "lt-full",
    ...overrides,
  };
}
