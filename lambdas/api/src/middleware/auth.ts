/**
 * Cognito authentication middleware.
 * Extracts userId (sub) from API Gateway REST API authorizer claims.
 * Verifies project ownership via DynamoDB lookup.
 */

import type { APIGatewayProxyEvent } from "aws-lambda";
import { UnauthorizedError, ForbiddenError } from "./errors.js";
import { getProject } from "../db/index.js";

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
 * Throws ForbiddenError if project belongs to another user.
 * Throws NotFoundError (via caller) if project does not exist.
 */
export async function verifyProjectOwnership(
  projectId: string,
  userId: string,
): Promise<void> {
  const project = await getProject(projectId);
  if (!project) {
    throw new ForbiddenError("Project not found or access denied");
  }
  if (project.userId !== userId) {
    throw new ForbiddenError("Access denied");
  }
}
