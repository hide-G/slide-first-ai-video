import { createLocalizedError } from "./i18n/errors.js";

export interface RuntimeConfig {
  apiEndpoint: string;
  cognitoUserPoolId: string;
  cognitoUserPoolClientId: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateRuntimeConfig(value: unknown): RuntimeConfig {
  if (typeof value !== "object" || value === null) {
    throw createLocalizedError("errors.runtimeConfigInvalid");
  }

  const config = value as Record<string, unknown>;
  if (
    !isNonEmptyString(config.apiEndpoint) ||
    !isNonEmptyString(config.cognitoUserPoolId) ||
    !isNonEmptyString(config.cognitoUserPoolClientId)
  ) {
    throw createLocalizedError("errors.runtimeConfigMissingRequired");
  }

  return {
    apiEndpoint: config.apiEndpoint.trim(),
    cognitoUserPoolId: config.cognitoUserPoolId.trim(),
    cognitoUserPoolClientId: config.cognitoUserPoolClientId.trim(),
  };
}

function getLocalDevelopmentFallback(): RuntimeConfig | undefined {
  if (!import.meta.env.DEV) {
    return undefined;
  }

  // Vite開発サーバーでのみ、明示されたローカル設定をフォールバックとして許可する。
  const fallback = {
    apiEndpoint: import.meta.env.VITE_API_ENDPOINT,
    cognitoUserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
    cognitoUserPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
  };

  if (Object.values(fallback).some((value) => !isNonEmptyString(value))) {
    return undefined;
  }

  return validateRuntimeConfig(fallback);
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const response = await fetch("/runtime-config.json", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw createLocalizedError("errors.runtimeConfigFetchFailed", {
        status: response.status,
      });
    }

    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw createLocalizedError("errors.runtimeConfigInvalidJson");
    }

    return validateRuntimeConfig(value);
  } catch (error) {
    const fallback = getLocalDevelopmentFallback();
    if (fallback) {
      return fallback;
    }

    if (error instanceof Error) {
      throw error;
    }

    throw createLocalizedError("errors.runtimeConfigUnknown");
  }
}
