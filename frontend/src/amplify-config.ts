import type { RuntimeConfig } from "./runtime-config.js";

/**
 * CDKが配布した実行時設定から構築するAWS Amplify設定。
 */
export interface AmplifyConfig {
  Auth: {
    Cognito: {
      userPoolId: string;
      userPoolClientId: string;
    };
  };
}

export function getAmplifyConfig(runtimeConfig: RuntimeConfig): AmplifyConfig {
  return {
    Auth: {
      Cognito: {
        userPoolId: runtimeConfig.cognitoUserPoolId,
        userPoolClientId: runtimeConfig.cognitoUserPoolClientId,
      },
    },
  };
}
