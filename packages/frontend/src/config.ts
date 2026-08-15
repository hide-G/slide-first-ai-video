/** アプリケーション設定。環境変数から読み込む。 */
export const config = {
  apiEndpoint: import.meta.env.VITE_API_ENDPOINT || "",
  cognitoUserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || "",
  cognitoClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || "",
  cognitoRegion: import.meta.env.VITE_COGNITO_REGION || "ap-northeast-1",
};
