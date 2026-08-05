/**
 * Cognito authentication middleware.
 * Extracts userId (sub claim) from API Gateway event requestContext.
 */

import type { APIGatewayProxyEventV2 } from "aws-lambda";

/**
 * Extract the authenticated userId from the Cognito JWT claims.
 * Returns the "sub" claim from the authorizer context.
 */
export function extractUserId(event: APIGatewayProxyEventV2): string | null {
  // API Gateway HTTP API (v2) with JWT authorizer
  const claims = (
    event.requestContext as unknown as {
      authorizer?: { jwt?: { claims?: Record<string, string> } };
    }
  )?.authorizer?.jwt?.claims;

  if (claims?.sub) {
    return claims.sub;
  }

  // Fallback: REST API (v1) style authorizer claims
  const restClaims = (
    event.requestContext as unknown as {
      authorizer?: { claims?: Record<string, string> };
    }
  )?.authorizer?.claims;

  if (restClaims?.sub) {
    return restClaims.sub;
  }

  return null;
}
