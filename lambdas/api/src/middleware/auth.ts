/**
 * Cognito authentication middleware.
 * Extracts userId (sub) from API Gateway REST API authorizer claims.
 * Verifies project ownership via DynamoDB lookup.
 */

import type { APIGatewayProxyEvent } from "aws-lambda";
import { UnauthorizedError, ForbiddenError } from "./errors.js";
import { getProjectByUser } from "../db/index.js";
import type { ProjectRecord } from "../db/projects.js";

/**
 * Extract authenticated Cognito user's sub claim.
 */
export function extractUserId(event: APIGatewayProxyEvent): string | null {
  const sub = event.requestContext.authorizer?.claims?.sub;
  return typeof sub === "string" ? sub : null;
}

/**
 * Require authentication. Throws UnauthorizedError if no user context.
 */
export function requireAuth(event: APIGatewayProxyEvent): string {
  const userId = extractUserId(event);
  if (!userId) {
    throw new UnauthorizedError();
  }
  return userId;
}

/**
 * Verify that the authenticated user owns the project.
 * Uses direct GetItem on primary key (PK=USER#{userId}, SK=PROJECT#{projectId})
 * which is both faster and inherently proves ownership without needing a GSI.
 * Throws ForbiddenError if project does not exist under this user.
 */
export async function verifyProjectOwnership(
  projectId: string,
  userId: string,
): Promise<ProjectRecord> {
  const project = await getProjectByUser(userId, projectId);
  if (!project) {
    throw new ForbiddenError("Project not found or access denied");
  }
  // 取得したレコードを返す。呼び出し側が再度読み直さずに使えるようにする
  return project;
}
