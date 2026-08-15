import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  TeaserCompositionBuilderEvent,
  SelectedSlide,
} from "@slide-first/shared-types";

// Mock S3 client
vi.mock("@aws-sdk/client-s3", () => {
  const mockSend = vi.fn().mockResolvedValue({});
  return {
    S3Client: vi.fn(() => ({ send: mockSend })),
    PutObjectCommand: vi.fn((input) => input),
    __mockSend: mockSend,
  };
});

import { buildTeaserHtml } from "./index.js";

const testSlides: SelectedSlide[] = [
  {
    slideNumber: 1,
    teaserNote: "First slide teaser note",
    keyPoints: ["Point A", "Point B"],
    imageKey: "slides/slide-1.png",
    estimatedDurationMs: 8000,
  },
  {
    slideNumber: 3,
    teaserNote: "Third slide teaser note",
    keyPoints: ["Point C", "Point D"],
    imageKey: "slides/slide-3.png",
    estimatedDurationMs: 10000,
  },
  {
    slideNumber: 5,
    teaserNote: "Fifth slide teaser note",
    keyPoints: ["Point E"],
    imageKey: "slides/slide-5.png",
    estimatedDurationMs: 7000,
  },
];

describe("buildTeaserHtml - 16:9 layout", () => {
  it("generates valid HTML with composition metadata", () => {
    const html = buildTeaserHtml(testSlides, "Mind blown?", "Follow for more", "16x9", "/assets/");

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('data-composition-width="1920"');
    expect(html).toContain('data-composition-height="1080"');
    expect(html).toContain('data-composition-fps="30"');
  });

  it("includes hook overlay at the start", () => {
    const html = buildTeaserHtml(testSlides, "Mind blown?", "Follow!", "16x9", "/assets/");

    expect(html).toContain("hook-overlay");
    expect(html).toContain("Mind blown?");
    expect(html).toContain('data-start="0"');
    expect(html).toContain('data-duration="2000"');
  });

  it("includes slide frames with correct timing", () => {
    const html = buildTeaserHtml(testSlides, "Hook", "CTA", "16x9", "/assets/");

    // First slide starts after hook (2000ms)
    expect(html).toContain('data-start="2000" data-duration="8000"');
    // Second slide starts at 2000+8000=10000ms
    expect(html).toContain('data-start="10000" data-duration="10000"');
    // Third slide starts at 10000+10000=20000ms
    expect(html).toContain('data-start="20000" data-duration="7000"');
  });

  it("includes CTA overlay at the end", () => {
    const html = buildTeaserHtml(testSlides, "Hook", "Follow!", "16x9", "/assets/");

    expect(html).toContain("cta-overlay");
    expect(html).toContain("Follow!");
    // CTA starts at 2000 + 8000 + 10000 + 7000 = 27000ms
    expect(html).toContain('data-start="27000" data-duration="3000"');
  });

  it("calculates total duration correctly", () => {
    const html = buildTeaserHtml(testSlides, "Hook", "CTA", "16x9", "/assets/");

    // Total: 2000 + 8000 + 10000 + 7000 + 3000 = 30000ms
    expect(html).toContain('data-composition-duration="30000"');
  });

  it("includes subtitle overlays with teaserNote", () => {
    const html = buildTeaserHtml(testSlides, "Hook", "CTA", "16x9", "/assets/");

    expect(html).toContain("First slide teaser note");
    expect(html).toContain("subtitle-overlay");
  });

  it("references slide images with assets prefix", () => {
    const html = buildTeaserHtml(testSlides, "Hook", "CTA", "16x9", "/assets/");

    expect(html).toContain('src="/assets/slides/slide-1.png"');
    expect(html).toContain('src="/assets/slides/slide-3.png"');
  });
});

describe("buildTeaserHtml - 9:16 layout", () => {
  it("generates 9:16 dimensions", () => {
    const html = buildTeaserHtml(testSlides, "Hook", "CTA", "9x16", "/assets/");

    expect(html).toContain('data-composition-width="1080"');
    expect(html).toContain('data-composition-height="1920"');
  });

  it("includes slide-card class for vertical layout", () => {
    const html = buildTeaserHtml(testSlides, "Hook", "CTA", "9x16", "/assets/");

    expect(html).toContain("slide-card");
    expect(html).toContain("slide-image-area");
    expect(html).toContain("caption-area");
  });

  it("includes keyPoints in the caption area", () => {
    const html = buildTeaserHtml(testSlides, "Hook", "CTA", "9x16", "/assets/");

    expect(html).toContain("Point A");
    expect(html).toContain("Point B");
    expect(html).toContain("key-point");
  });

  it("includes slide-card CSS", () => {
    const html = buildTeaserHtml(testSlides, "Hook", "CTA", "9x16", "/assets/");

    expect(html).toContain(".slide-card");
    expect(html).toContain(".key-points-list");
    expect(html).toContain(".teaser-caption");
  });
});

describe("handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads HTML to S3 and returns result", async () => {
    const { handler } = await import("./index.js");

    const event: TeaserCompositionBuilderEvent = {
      projectId: "proj-123",
      userId: "user-456",
      versionNumber: 1,
      jobId: "job-789",
      s3Bucket: "test-bucket",
      s3Prefix: "projects/proj-123/v1/",
      assetsPrefix: "/assets/",
      selectedSlides: testSlides,
      hookText: "Check this out",
      ctaText: "Follow for more",
      layout: "16x9",
    };

    const result = await handler(event);

    expect(result.compositionKey).toBe("projects/proj-123/v1/teaser/16x9/index.html");
    expect(result.totalSlides).toBe(3);
    // 2000 + 8000 + 10000 + 7000 + 3000 = 30000ms
    expect(result.totalDurationMs).toBe(30000);
    expect(result.layout).toBe("16x9");
  });

  it("handles 9x16 layout", async () => {
    const { handler } = await import("./index.js");

    const event: TeaserCompositionBuilderEvent = {
      projectId: "proj-123",
      userId: "user-456",
      versionNumber: 1,
      jobId: "job-789",
      s3Bucket: "test-bucket",
      s3Prefix: "projects/proj-123/v1/",
      assetsPrefix: "/assets/",
      selectedSlides: testSlides,
      hookText: "Hook",
      layout: "9x16",
    };

    const result = await handler(event);

    expect(result.compositionKey).toBe("projects/proj-123/v1/teaser/9x16/index.html");
    expect(result.layout).toBe("9x16");
  });
});
