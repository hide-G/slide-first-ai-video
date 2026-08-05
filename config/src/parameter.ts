/**
 * Environment-specific configuration.
 * Each environment (dev/stg/prd) defines its own settings.
 */

export interface VoiceSettings {
  voiceId: string;
  engine: string;
  sampleRate: string;
}

export interface EnvironmentConfig {
  /** Environment name */
  env: "dev" | "stg" | "prd";
  /** Product slug - used for bucket naming and CDK context */
  productSlug: string;
  /** AWS region */
  region: string;
  /** Bedrock model ID for content generation */
  bedrockModelId: string;
  /** Default voice settings for Polly */
  voice: VoiceSettings;
  /** Video output FPS */
  defaultFps: number;
  /** Default video bitrate in kbps */
  defaultBitrateKbps: number;
  /** Log retention in days */
  logRetentionDays: number;
}

const baseConfig = {
  productSlug: "ltvideo",
  voice: {
    voiceId: "Takumi",
    engine: "neural",
    sampleRate: "24000",
  } satisfies VoiceSettings,
  defaultFps: 30,
  defaultBitrateKbps: 6000,
};

export const devConfig: EnvironmentConfig = {
  ...baseConfig,
  env: "dev",
  region: "us-east-1",
  bedrockModelId: "anthropic.claude-sonnet-4-20250514-v1:0",
  logRetentionDays: 7,
};

export const stgConfig: EnvironmentConfig = {
  ...baseConfig,
  env: "stg",
  region: "us-east-1",
  bedrockModelId: "anthropic.claude-sonnet-4-20250514-v1:0",
  logRetentionDays: 14,
};

export const prdConfig: EnvironmentConfig = {
  ...baseConfig,
  env: "prd",
  region: "us-east-1",
  bedrockModelId: "anthropic.claude-sonnet-4-20250514-v1:0",
  logRetentionDays: 90,
};

/** Get configuration for a specific environment */
export function getConfig(env: "dev" | "stg" | "prd"): EnvironmentConfig {
  switch (env) {
    case "dev":
      return devConfig;
    case "stg":
      return stgConfig;
    case "prd":
      return prdConfig;
  }
}
