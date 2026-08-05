/**
 * Tests for Bedrock client wrapper.
 */

import { describe, it, expect, vi } from "vitest";
import { callBedrockConverse, type BedrockConfig } from "./bedrock-client.js";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

// Mock the BedrockRuntimeClient
vi.mock("@aws-sdk/client-bedrock-runtime", () => {
  const MockBedrockRuntimeClient = vi.fn();
  MockBedrockRuntimeClient.prototype.send = vi.fn();

  return {
    BedrockRuntimeClient: MockBedrockRuntimeClient,
    ConverseCommand: vi.fn().mockImplementation((input) => ({ input })),
  };
});

describe("callBedrockConverse", () => {
  const config: BedrockConfig = {
    modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
    maxTokens: 8000,
  };

  it("returns content from a successful response", async () => {
    const mockClient = new BedrockRuntimeClient({});
    (mockClient.send as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: {
        message: {
          content: [{ text: "Generated markdown content" }],
        },
      },
      usage: {
        inputTokens: 100,
        outputTokens: 500,
      },
    });

    const result = await callBedrockConverse(
      "System prompt",
      "User prompt",
      config,
      mockClient,
    );

    expect(result.content).toBe("Generated markdown content");
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(500);
  });

  it("throws on empty response", async () => {
    const mockClient = new BedrockRuntimeClient({});
    (mockClient.send as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: {
        message: {
          content: [],
        },
      },
    });

    await expect(
      callBedrockConverse("System", "User", config, mockClient),
    ).rejects.toThrow("Bedrock returned empty response");
  });

  it("throws when no text content in response", async () => {
    const mockClient = new BedrockRuntimeClient({});
    (mockClient.send as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: {
        message: {
          content: [{ image: {} }],
        },
      },
    });

    await expect(
      callBedrockConverse("System", "User", config, mockClient),
    ).rejects.toThrow("Bedrock response contained no text content");
  });

  it("passes modelId and maxTokens in the command", async () => {
    const mockClient = new BedrockRuntimeClient({});
    (mockClient.send as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: {
        message: {
          content: [{ text: "response" }],
        },
      },
      usage: {},
    });

    await callBedrockConverse("System", "User", config, mockClient);

    expect(mockClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
          inferenceConfig: { maxTokens: 8000 },
        }),
      }),
    );
  });

  it("structures system and user messages correctly", async () => {
    const mockClient = new BedrockRuntimeClient({});
    (mockClient.send as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: {
        message: {
          content: [{ text: "response" }],
        },
      },
      usage: {},
    });

    await callBedrockConverse("My system prompt", "My user prompt", config, mockClient);

    expect(mockClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          system: [{ text: "My system prompt" }],
          messages: [
            {
              role: "user",
              content: [{ text: "My user prompt" }],
            },
          ],
        }),
      }),
    );
  });
});
