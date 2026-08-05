/**
 * Tests for slide generator Lambda handler.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock AWS SDK clients
vi.mock("@aws-sdk/client-bedrock-runtime", () => {
  const MockBedrockRuntimeClient = vi.fn();
  MockBedrockRuntimeClient.prototype.send = vi.fn();
  return {
    BedrockRuntimeClient: MockBedrockRuntimeClient,
    ConverseCommand: vi.fn().mockImplementation((input) => ({ input })),
  };
});

vi.mock("@aws-sdk/client-s3", () => {
  const MockS3Client = vi.fn();
  MockS3Client.prototype.send = vi.fn().mockResolvedValue({});
  return {
    S3Client: MockS3Client,
    PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  };
});

// We need to mock the bedrock-client module to avoid real API calls
vi.mock("./bedrock-client.js", () => ({
  callBedrockConverse: vi.fn(),
}));

import { handler, type SlideGeneratorEvent } from "./index.js";
import { callBedrockConverse } from "./bedrock-client.js";

const MOCK_BEDROCK_RESPONSE = `---
marp: true
theme: default
paginate: true
---

# Introduction

Welcome to this presentation

<!--
Hello everyone, welcome to this presentation about our topic.
-->

---

# Key Concept

- Important point one
- Important point two

<!--
Let me explain the key concept in detail. This is the main takeaway.
-->

---

# Conclusion

Thank you for watching

<!--
In conclusion, we covered the main points. Thank you for your attention.
-->

---METADATA---

[
  {
    "slideNumber": 1,
    "keyPoints": ["Introduction and welcome"],
    "importance": "MEDIUM",
    "teaserNote": "Welcome to the presentation",
    "includeInXTeaser": false
  },
  {
    "slideNumber": 2,
    "keyPoints": ["Key concept explained"],
    "importance": "HIGH",
    "teaserNote": "The most important concept",
    "includeInXTeaser": true
  },
  {
    "slideNumber": 3,
    "keyPoints": ["Summary and conclusion"],
    "importance": "LOW",
    "teaserNote": "Wrapping up",
    "includeInXTeaser": false
  }
]`;

describe("handler", () => {
  const baseEvent: SlideGeneratorEvent = {
    projectId: "proj-123",
    userId: "user-456",
    version: 1,
    theme: "AI in Healthcare",
    audience: "Medical professionals",
    durationMinutes: 1,
    urls: ["https://example.com/article"],
    s3Bucket: "test-bucket",
    s3Prefix: "projects/proj-123/v1/",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BEDROCK_MODEL_ID = "anthropic.claude-3-sonnet-20240229-v1:0";
    process.env.BEDROCK_MAX_TOKENS = "8000";
  });

  it("throws if BEDROCK_MODEL_ID is not set", async () => {
    delete process.env.BEDROCK_MODEL_ID;

    await expect(handler(baseEvent)).rejects.toThrow("BEDROCK_MODEL_ID environment variable");
  });

  it("returns slide data on successful generation", async () => {
    (callBedrockConverse as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: MOCK_BEDROCK_RESPONSE,
      inputTokens: 200,
      outputTokens: 1000,
    });

    const result = await handler(baseEvent);

    expect(result.deckKey).toBe("projects/proj-123/v1/deck.md");
    expect(result.slideCount).toBe(3);
    expect(result.slides).toHaveLength(3);
    expect(result.inputTokens).toBe(200);
    expect(result.outputTokens).toBe(1000);
  });

  it("includes slide metadata in output", async () => {
    (callBedrockConverse as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: MOCK_BEDROCK_RESPONSE,
      inputTokens: 100,
      outputTokens: 500,
    });

    const result = await handler(baseEvent);

    expect(result.slides[0].presenterNote).toContain("Hello everyone");
    expect(result.slides[0].keyPoints).toEqual(["Introduction and welcome"]);
    expect(result.slides[0].importance).toBe("MEDIUM");
    expect(result.slides[0].teaserNote).toBe("Welcome to the presentation");

    expect(result.slides[1].importance).toBe("HIGH");
    expect(result.slides[1].includeInXTeaser).toBe(true);
  });

  it("calls callBedrockConverse with correct config", async () => {
    (callBedrockConverse as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: MOCK_BEDROCK_RESPONSE,
      inputTokens: 100,
      outputTokens: 500,
    });

    await handler(baseEvent);

    expect(callBedrockConverse).toHaveBeenCalledWith(
      expect.any(String), // system prompt
      expect.any(String), // user prompt
      {
        modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
        maxTokens: 8000,
      },
    );
  });

  it("throws when validation fails", async () => {
    // Return content without presenter notes to trigger validation failure
    const invalidResponse = `---
marp: true
---

# Slide Without Note

---METADATA---

[
  {
    "slideNumber": 1,
    "keyPoints": ["Point"],
    "importance": "HIGH",
    "teaserNote": "Teaser",
    "includeInXTeaser": true
  }
]`;

    (callBedrockConverse as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: invalidResponse,
      inputTokens: 50,
      outputTokens: 100,
    });

    await expect(handler(baseEvent)).rejects.toThrow("Slide validation failed");
  });

  it("uses default maxTokens when env var is not set", async () => {
    delete process.env.BEDROCK_MAX_TOKENS;

    (callBedrockConverse as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: MOCK_BEDROCK_RESPONSE,
      inputTokens: 100,
      outputTokens: 500,
    });

    await handler(baseEvent);

    expect(callBedrockConverse).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ maxTokens: 8000 }),
    );
  });
});
