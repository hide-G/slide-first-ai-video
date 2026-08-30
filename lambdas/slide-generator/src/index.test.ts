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

import {
  handler,
  type GenerateNarrationEvent,
  type SlideGeneratorEvent,
} from "./index.js";
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


describe("ナレーション原稿の言語制御", () => {
  const narrationEvent: GenerateNarrationEvent = {
    action: "generateNarration",
    projectId: "proj-123",
    userId: "user-456",
    pageNumber: 1,
    pageText: "Amazon MediaConvert creates adaptive bitrate video outputs for multiple devices.",
    languageCode: "en-US",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BEDROCK_MODEL_ID = "anthropic.claude-3-sonnet-20240229-v1:0";
  });

  it("指定した英語だけを要求し、解決済み言語を返す", async () => {
    (callBedrockConverse as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: "This slide explains how MediaConvert prepares video outputs for each device.",
      inputTokens: 40,
      outputTokens: 20,
    });

    const result = await handler(narrationEvent);

    expect(result).toMatchObject({
      script: {
        pageNumber: 1,
        mode: "plain",
        languageCode: "en-US",
      },
    });
    expect(callBedrockConverse).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("Output language: English (en-US) only."),
      expect.objectContaining({ maxTokens: 600 }),
    );
  });

  it("初回の言語が不一致なら訂正プロンプトで1回だけ再試行する", async () => {
    (callBedrockConverse as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        content: "このスライドではMediaConvertの出力設定を説明します。",
        inputTokens: 40,
        outputTokens: 20,
      })
      .mockResolvedValueOnce({
        content: "This slide explains the MediaConvert output settings.",
        inputTokens: 45,
        outputTokens: 25,
      });

    const result = await handler(narrationEvent);

    expect(result).toMatchObject({ script: { languageCode: "en-US" } });
    expect(result.inputTokens).toBe(85);
    expect(result.outputTokens).toBe(45);
    expect(callBedrockConverse).toHaveBeenCalledTimes(2);
    expect(callBedrockConverse).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.stringContaining("前回の応答は指定言語の検証を通りませんでした。"),
      expect.any(Object),
    );
  });

  it("再試行後も言語が不一致なら専用エラーで失敗する", async () => {
    (callBedrockConverse as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: "このスライドではMediaConvertの出力設定を説明します。",
      inputTokens: 40,
      outputTokens: 20,
    });

    await expect(handler(narrationEvent)).rejects.toMatchObject({
      name: "NARRATION_LANGUAGE_MISMATCH",
    });
    expect(callBedrockConverse).toHaveBeenCalledTimes(2);
  });
});


describe("ナレーション原稿の厳密な言語検証", () => {
  const englishNarrationEvent: GenerateNarrationEvent = {
    action: "generateNarration",
    projectId: "proj-123",
    userId: "user-456",
    pageNumber: 1,
    pageText: "Amazon MediaConvert creates adaptive bitrate video outputs for multiple devices.",
    languageCode: "en-US",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BEDROCK_MODEL_ID = "anthropic.claude-3-sonnet-20240229-v1:0";
  });

  it("英語原稿へ日本語が混在した初回応答を訂正して再試行する", async () => {
    (callBedrockConverse as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        content:
          "This slide explains the MediaConvert workflow for multiple devices. 日本語の注記です。",
        inputTokens: 40,
        outputTokens: 20,
      })
      .mockResolvedValueOnce({
        content: "This slide explains the MediaConvert workflow for multiple devices.",
        inputTokens: 45,
        outputTokens: 25,
      });

    const result = await handler(englishNarrationEvent);

    expect(result).toMatchObject({ script: { languageCode: "en-US" } });
    expect(callBedrockConverse).toHaveBeenCalledTimes(2);
  });

  it("マークアップ内の日本語が混在した英語原稿を訂正して再試行する", async () => {
    (callBedrockConverse as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        content:
          "This slide explains the MediaConvert workflow for multiple devices. <日本語の注記です。>",
        inputTokens: 40,
        outputTokens: 20,
      })
      .mockResolvedValueOnce({
        content: "This slide explains the MediaConvert workflow for multiple devices.",
        inputTokens: 45,
        outputTokens: 25,
      });

    const result = await handler(englishNarrationEvent);

    expect(result).toMatchObject({ script: { languageCode: "en-US" } });
    expect(callBedrockConverse).toHaveBeenCalledTimes(2);
  });

  it("AWS製品名を含む日本語原稿は再試行せずに受理する", async () => {
    (callBedrockConverse as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: "Amazon EC2 は、クラウド上で仮想サーバーを提供します。",
      inputTokens: 40,
      outputTokens: 20,
    });

    const result = await handler({ ...englishNarrationEvent, languageCode: "ja-JP" });

    expect(result).toMatchObject({ script: { languageCode: "ja-JP" } });
    expect(callBedrockConverse).toHaveBeenCalledTimes(1);
  });

  it("漢字だけの中国語が混在した日本語原稿を訂正して再試行する", async () => {
    (callBedrockConverse as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        content: "これは日本語です。這是中文說明。",
        inputTokens: 40,
        outputTokens: 20,
      })
      .mockResolvedValueOnce({
        content: "このスライドではMediaConvertの処理内容を説明します。",
        inputTokens: 45,
        outputTokens: 25,
      });

    const result = await handler({ ...englishNarrationEvent, languageCode: "ja-JP" });

    expect(result).toMatchObject({ script: { languageCode: "ja-JP" } });
    expect(callBedrockConverse).toHaveBeenCalledTimes(2);
  });

  it("句読点なしで連結した中国語を含む日本語原稿を訂正して再試行する", async () => {
    (callBedrockConverse as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        content: "これは日本語のナレーションです本次报告介绍人工智能技术",
        inputTokens: 40,
        outputTokens: 20,
      })
      .mockResolvedValueOnce({
        content: "このスライドではMediaConvertの処理内容を説明します。",
        inputTokens: 45,
        outputTokens: 25,
      });

    const result = await handler({ ...englishNarrationEvent, languageCode: "ja-JP" });

    expect(result).toMatchObject({ script: { languageCode: "ja-JP" } });
    expect(callBedrockConverse).toHaveBeenCalledTimes(2);
  });

  it("将来と与えるを含む自然な日本語原稿は再試行せずに受理する", async () => {
    (callBedrockConverse as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: "将来の計画を説明し、利用者に価値を与える仕組みを紹介します。",
      inputTokens: 40,
      outputTokens: 20,
    });

    const result = await handler({ ...englishNarrationEvent, languageCode: "ja-JP" });

    expect(result).toMatchObject({ script: { languageCode: "ja-JP" } });
    expect(callBedrockConverse).toHaveBeenCalledTimes(1);
  });

  it("英語優勢の混在原稿を日本語指定では訂正して再試行する", async () => {
    (callBedrockConverse as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        content: "This English sentence has some words. 日本語の文章を説明します。",
        inputTokens: 40,
        outputTokens: 20,
      })
      .mockResolvedValueOnce({
        content: "このスライドではMediaConvertの処理内容を説明します。",
        inputTokens: 45,
        outputTokens: 25,
      });

    const result = await handler({ ...englishNarrationEvent, languageCode: "ja-JP" });

    expect(result).toMatchObject({ script: { languageCode: "ja-JP" } });
    expect(callBedrockConverse).toHaveBeenCalledTimes(2);
  });

  it("第三言語が混在した英語指定の初回応答を訂正して再試行する", async () => {
    (callBedrockConverse as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        content: "Русский текст abc",
        inputTokens: 40,
        outputTokens: 20,
      })
      .mockResolvedValueOnce({
        content: "This slide explains the MediaConvert workflow for multiple devices.",
        inputTokens: 45,
        outputTokens: 25,
      });

    const result = await handler(englishNarrationEvent);

    expect(result).toMatchObject({ script: { languageCode: "en-US" } });
    expect(callBedrockConverse).toHaveBeenCalledTimes(2);
  });
});