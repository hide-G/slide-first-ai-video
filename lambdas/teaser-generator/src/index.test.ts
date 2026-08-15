import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ManifestSlide, TeaserGeneratorEvent } from "@slide-first/shared-types";

// Mock the Bedrock client
vi.mock("@aws-sdk/client-bedrock-runtime", () => {
  const mockSend = vi.fn();
  return {
    BedrockRuntimeClient: vi.fn(() => ({ send: mockSend })),
    ConverseCommand: vi.fn((input) => input),
    __mockSend: mockSend,
  };
});

function makeSlide(num: number, importance: "HIGH" | "MEDIUM" | "LOW" = "HIGH"): ManifestSlide {
  return {
    slideNumber: num,
    imageKey: `slides/slide-${num}.png`,
    imageSha256: `hash${num}`,
    presenterNote: `Full note for slide ${num}`,
    teaserNote: `Short teaser for slide ${num} with some words`,
    keyPoints: [`Key point A of slide ${num}`, `Key point B of slide ${num}`],
    voiceKey: `audio/slide-${num}.pcm`,
    speechMarksKey: `audio/slide-${num}.marks.json`,
    measuredAudioMs: 8000,
    leadInMs: 200,
    leadOutMs: 300,
    durationMs: 8500,
    startMs: (num - 1) * 8500,
    transition: "fade",
    importance,
    includeInXTeaser: importance === "HIGH",
  };
}

describe("teaser-generator handler", () => {
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    process.env.BEDROCK_MODEL_ID = "anthropic.claude-sonnet-4-20250514";

    const bedrockMod = await import("@aws-sdk/client-bedrock-runtime");
    mockSend = (bedrockMod as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend;
    mockSend.mockReset();
  });

  it("calls Bedrock 3 times: selection, hook, post text", async () => {
    // Mock responses
    mockSend
      .mockResolvedValueOnce({
        output: {
          message: {
            content: [{ text: JSON.stringify({ selectedSlideNumbers: [1, 2, 3], reasoning: "test" }) }],
          },
        },
        usage: { inputTokens: 100, outputTokens: 50 },
      })
      .mockResolvedValueOnce({
        output: {
          message: {
            content: [{ text: JSON.stringify({
              hooks: [
                { text: "Mind blown?", rank: 1 },
                { text: "Check this", rank: 2 },
                { text: "Watch now", rank: 3 },
              ],
            }) }],
          },
        },
        usage: { inputTokens: 80, outputTokens: 40 },
      })
      .mockResolvedValueOnce({
        output: {
          message: {
            content: [{ text: JSON.stringify({
              text: "Amazing insights from our latest talk! #AI #Tech",
              hashtags: ["#AI", "#Tech"],
              sourceLinks: ["https://example.com/source"],
            }) }],
          },
        },
        usage: { inputTokens: 90, outputTokens: 45 },
      });

    const { handler } = await import("./index.js");

    const event: TeaserGeneratorEvent = {
      projectId: "proj-123",
      userId: "user-456",
      versionNumber: 1,
      jobId: "job-789",
      s3Bucket: "test-bucket",
      s3Prefix: "projects/proj-123/v1/",
      slides: [makeSlide(1), makeSlide(2), makeSlide(3), makeSlide(4, "MEDIUM")],
      references: ["https://example.com/source"],
    };

    const result = await handler(event);

    expect(mockSend).toHaveBeenCalledTimes(3);
    expect(result.selectedSlides).toHaveLength(3);
    expect(result.hookCandidates).toHaveLength(3);
    expect(result.hookCandidates[0].text).toBe("Mind blown?");
    expect(result.postText.text).toContain("Amazing insights");
    expect(result.postText.hashtags).toContain("#AI");
    expect(result.inputTokens).toBe(270);
    expect(result.outputTokens).toBe(135);
  });

  it("throws if BEDROCK_MODEL_ID is not set", async () => {
    delete process.env.BEDROCK_MODEL_ID;
    const { handler } = await import("./index.js");

    const event: TeaserGeneratorEvent = {
      projectId: "proj-123",
      userId: "user-456",
      versionNumber: 1,
      jobId: "job-789",
      s3Bucket: "test-bucket",
      s3Prefix: "prefix/",
      slides: [makeSlide(1), makeSlide(2), makeSlide(3)],
    };

    await expect(handler(event)).rejects.toThrow("BEDROCK_MODEL_ID");
  });
});
