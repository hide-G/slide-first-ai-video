import { describe, it, expect } from "vitest";
import { buildCompositionHtml } from "./html-builder.js";
import type { VideoManifest, OutputConfig } from "@slide-first/shared-types";

describe("HTML builder", () => {
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
        presenterNote: "This is the second slide with more details",
        teaserNote: "Details",
        keyPoints: ["details"],
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

  it("generates valid HTML with DOCTYPE", () => {
    const html = buildCompositionHtml({
      manifest: sampleManifest,
      output: sampleOutput,
      assetsPrefix: "https://cdn.example.com/",
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<html lang="ja">');
  });

  it("includes stage div with correct data attributes", () => {
    const html = buildCompositionHtml({
      manifest: sampleManifest,
      output: sampleOutput,
      assetsPrefix: "/assets/",
    });

    expect(html).toContain('id="stage"');
    expect(html).toContain('data-composition-id="lt-full-16x9"');
    expect(html).toContain('data-width="1920"');
    expect(html).toContain('data-height="1080"');
    expect(html).toContain('data-fps="30"');
  });

  it("includes img clips with correct timing in seconds", () => {
    const html = buildCompositionHtml({
      manifest: sampleManifest,
      output: sampleOutput,
      assetsPrefix: "/assets/",
    });

    // Slide 1: startMs=0, durationMs=4000
    expect(html).toContain('data-start="0.000"');
    expect(html).toContain('data-duration="4.000"');
    expect(html).toContain('src="/assets/slides/deck.001.png"');

    // Slide 2: startMs=4000, durationMs=6000
    expect(html).toContain('data-start="4.000"');
    expect(html).toContain('data-duration="6.000"');
    expect(html).toContain('src="/assets/slides/deck.002.png"');
  });

  it("includes audio elements with correct timing", () => {
    const html = buildCompositionHtml({
      manifest: sampleManifest,
      output: sampleOutput,
      assetsPrefix: "/assets/",
    });

    // Audio uses measuredAudioMs for duration
    expect(html).toContain('<audio src="/assets/audio/slide-001.pcm"');
    expect(html).toContain('<audio src="/assets/audio/slide-002.pcm"');
    // Slide 1 audio: 3000ms = 3.000s
    expect(html).toMatch(/audio.*data-duration="3\.000"/);
    // Slide 2 audio: 5000ms = 5.000s
    expect(html).toMatch(/audio.*data-duration="5\.000"/);
  });

  it("includes caption overlay divs with text", () => {
    const html = buildCompositionHtml({
      manifest: sampleManifest,
      output: sampleOutput,
      assetsPrefix: "/assets/",
    });

    expect(html).toContain("caption-overlay");
    expect(html).toContain("Welcome to the presentation");
    expect(html).toContain("This is the second slide with more details");
  });

  it("escapes HTML in caption text", () => {
    const manifestWithHtml: VideoManifest = {
      ...sampleManifest,
      slides: [
        {
          ...sampleManifest.slides[0],
          presenterNote: 'Text with <script>alert("xss")</script>',
        },
      ],
    };

    const html = buildCompositionHtml({
      manifest: manifestWithHtml,
      output: sampleOutput,
      assetsPrefix: "/assets/",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("truncates long presenter notes in captions", () => {
    const longNote = "A".repeat(150);
    const manifestWithLongNote: VideoManifest = {
      ...sampleManifest,
      slides: [
        {
          ...sampleManifest.slides[0],
          presenterNote: longNote,
        },
      ],
    };

    const html = buildCompositionHtml({
      manifest: manifestWithLongNote,
      output: sampleOutput,
      assetsPrefix: "/assets/",
    });

    // Should be truncated to 100 chars + "..."
    expect(html).toContain("A".repeat(100) + "...");
    expect(html).not.toContain("A".repeat(101));
  });

  it("uses correct asset prefix for all resources", () => {
    const html = buildCompositionHtml({
      manifest: sampleManifest,
      output: sampleOutput,
      assetsPrefix: "https://bucket.s3.amazonaws.com/prefix/",
    });

    expect(html).toContain('src="https://bucket.s3.amazonaws.com/prefix/slides/deck.001.png"');
    expect(html).toContain('src="https://bucket.s3.amazonaws.com/prefix/audio/slide-001.pcm"');
  });
});
