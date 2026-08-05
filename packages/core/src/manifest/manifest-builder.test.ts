import { describe, it, expect } from "vitest";
import { buildManifest } from "./manifest-builder.js";
import type { ManifestConfig, SlideInput } from "./manifest-builder.js";

const baseConfig: ManifestConfig = {
  schemaVersion: "1.0",
  deckId: "deck-001",
  deckVersion: 1,
  locale: "ja-JP",
  voice: {
    voiceId: "Takumi",
    engine: "neural",
    sampleRate: "24000",
  },
  outputs: {
    "16:9": {
      compositionId: "main-16-9",
      width: 1920,
      height: 1080,
      fps: 30,
      videoBitrateKbps: 5000,
    },
  },
  captions: {
    styleId: "default",
    maxCharsPerLine: 20,
    maxLines: 2,
    minDurationMs: 1200,
    captionsKey: "captions.json",
    vttKey: "captions.vtt",
    srtKey: "captions.srt",
  },
};

function makeSlideInput(overrides?: Partial<SlideInput>): SlideInput {
  return {
    slideNumber: 1,
    imageKey: "slides/001.png",
    imageSha256: "abc123",
    presenterNote: "Hello world",
    teaserNote: "Hook",
    keyPoints: ["TypeScript"],
    voiceKey: "audio/001.pcm",
    speechMarksKey: "marks/001.json",
    measuredAudioMs: 5000,
    ...overrides,
  };
}

describe("buildManifest", () => {
  it("builds a complete manifest with timing resolution", () => {
    const slides: SlideInput[] = [
      makeSlideInput({ slideNumber: 1, measuredAudioMs: 5000 }),
      makeSlideInput({ slideNumber: 2, measuredAudioMs: 3000 }),
    ];

    const manifest = buildManifest(baseConfig, slides);

    expect(manifest.schemaVersion).toBe("1.0");
    expect(manifest.deckId).toBe("deck-001");
    expect(manifest.slides).toHaveLength(2);
  });

  it("resolves timing for each slide", () => {
    const slides: SlideInput[] = [
      makeSlideInput({ slideNumber: 1, measuredAudioMs: 5000 }),
      makeSlideInput({ slideNumber: 2, measuredAudioMs: 3000 }),
    ];

    const manifest = buildManifest(baseConfig, slides);

    // Default leadIn=120, leadOut=400
    expect(manifest.slides[0].durationMs).toBe(5520);
    expect(manifest.slides[0].startMs).toBe(0);
    expect(manifest.slides[1].durationMs).toBe(3520);
    expect(manifest.slides[1].startMs).toBe(5520);
  });

  it("uses custom lead-in and lead-out", () => {
    const slides: SlideInput[] = [
      makeSlideInput({
        slideNumber: 1,
        measuredAudioMs: 5000,
        leadInMs: 200,
        leadOutMs: 500,
      }),
    ];

    const manifest = buildManifest(baseConfig, slides);
    expect(manifest.slides[0].durationMs).toBe(5700);
    expect(manifest.slides[0].leadInMs).toBe(200);
    expect(manifest.slides[0].leadOutMs).toBe(500);
  });

  it("uses default transition and importance", () => {
    const slides: SlideInput[] = [makeSlideInput()];
    const manifest = buildManifest(baseConfig, slides);

    expect(manifest.slides[0].transition).toBe("fade");
    expect(manifest.slides[0].importance).toBe("MEDIUM");
    expect(manifest.slides[0].includeInXTeaser).toBe(false);
  });

  it("preserves custom transition and importance", () => {
    const slides: SlideInput[] = [
      makeSlideInput({
        transition: "slide",
        importance: "HIGH",
        includeInXTeaser: true,
      }),
    ];
    const manifest = buildManifest(baseConfig, slides);

    expect(manifest.slides[0].transition).toBe("slide");
    expect(manifest.slides[0].importance).toBe("HIGH");
    expect(manifest.slides[0].includeInXTeaser).toBe(true);
  });

  it("handles empty slides array", () => {
    const manifest = buildManifest(baseConfig, []);
    expect(manifest.slides).toEqual([]);
    expect(manifest.schemaVersion).toBe("1.0");
  });

  it("preserves all config fields", () => {
    const slides: SlideInput[] = [makeSlideInput()];
    const manifest = buildManifest(baseConfig, slides);

    expect(manifest.voice).toEqual(baseConfig.voice);
    expect(manifest.outputs).toEqual(baseConfig.outputs);
    expect(manifest.captions).toEqual(baseConfig.captions);
    expect(manifest.locale).toBe("ja-JP");
    expect(manifest.deckVersion).toBe(1);
  });
});
