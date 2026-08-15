/**
 * Cognito認証ミドルウェア。
 * API Gateway REST APIのauthorizer claimsからuserId（sub）を取得する。
 */

import type { APIGatewayProxyEvent } from "aws-lambda";

/**
 * 認証済みCognitoユーザーのsub claimを返す。
 */
export function extractUserId(event: APIGatewayProxyEvent): string | null {
  const sub = event.requestContext.authorizer?.claims?.sub;
  return typeof sub === "string" ? sub : null;
}
