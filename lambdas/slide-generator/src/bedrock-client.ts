/**
 * Bedrock Converse API wrapper for slide generation.
 * Uses @aws-sdk/client-bedrock-runtime ConverseCommand.
 * modelId is always sourced from config (never hardcoded).
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type SystemContentBlock,
} from "@aws-sdk/client-bedrock-runtime";

/** Configuration for Bedrock calls */
export interface BedrockConfig {
  /** Model ID (e.g., "anthropic.claude-3-sonnet-20240229-v1:0") - NEVER hardcoded */
  modelId: string;
  /** Maximum tokens in the response */
  maxTokens: number;
  /** AWS region (optional, defaults to SDK default) */
  region?: string;
}

/** Result from Bedrock Converse API */
export interface BedrockResult {
  /** The generated text content */
  content: string;
  /** Input tokens used */
  inputTokens?: number;
  /** Output tokens used */
  outputTokens?: number;
}

/**
 * Call Bedrock Converse API with system and user messages.
 * @param systemPrompt - System instructions for the model
 * @param userPrompt - User message content
 * @param config - Bedrock configuration (modelId, maxTokens)
 * @param client - Optional pre-configured client (for testing)
 */
export async function callBedrockConverse(
  systemPrompt: string,
  userPrompt: string,
  config: BedrockConfig,
  client?: BedrockRuntimeClient,
): Promise<BedrockResult> {
  const bedrockClient = client ?? new BedrockRuntimeClient({ region: config.region });

  const system: SystemContentBlock[] = [{ text: systemPrompt }];

  const messages: Message[] = [
    {
      role: "user",
      content: [{ text: userPrompt }],
    },
  ];

  const command = new ConverseCommand({
    modelId: config.modelId,
    system,
    messages,
    inferenceConfig: {
      maxTokens: config.maxTokens,
    },
  });

  const response = await bedrockClient.send(command);

  // Extract text from response
  const outputContent = response.output?.message?.content;
  if (!outputContent || outputContent.length === 0) {
    throw new Error("Bedrock returned empty response");
  }

  const textBlock = outputContent.find((block) => "text" in block);
  if (!textBlock || !("text" in textBlock) || !textBlock.text) {
    throw new Error("Bedrock response contained no text content");
  }

  return {
    content: textBlock.text,
    inputTokens: response.usage?.inputTokens,
    outputTokens: response.usage?.outputTokens,
  };
}
