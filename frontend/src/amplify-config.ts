/**
 * AWS Amplify configuration from environment variables.
 */

export interface AmplifyConfig {
  Auth: {
    Cognito: {
      userPoolId: string;
      userPoolClientId: string;
    };
  };
}

export function getAmplifyConfig(): AmplifyConfig {
  return {
    Auth: {
      Cognito: {
        userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID ?? "",
        userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID ?? "",
      },
    },
  };
}
