/**
 * Project API handlers.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ulid } from "ulid";
import {
  extractUserId,
  extractIdempotencyKey,
  validateBody,
  CreateProjectSchema,
  buildResponse,
  UnauthorizedError,
} from "../middleware/index.js";
import {
  createProject,
  putIfAbsent,
  completeIdempotencyRecord,
  listProjectsByUser,
} from "../db/index.js";

export async function handleListProjects(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const userId = extractUserId(event);
  if (!userId) {
    throw new UnauthorizedError();
  }

  const nextToken = event.queryStringParameters?.nextToken;
  const { projects, nextToken: resultToken } = await listProjectsByUser(userId, nextToken);

  return buildResponse(200, {
    projects: projects.map((p) => ({
      projectId: p.projectId,
      userId: p.userId,
      title: p.title,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
    ...(resultToken ? { nextToken: resultToken } : {}),
  });
}

export async function handleCreateProject(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const userId = extractUserId(event);
  if (!userId) {
    throw new UnauthorizedError();
  }

  // Check idempotency
  const idempotencyKey = extractIdempotencyKey(event);
  if (idempotencyKey) {
    const existing = await putIfAbsent(idempotencyKey, userId);
    if (existing && existing.responseStatus > 0) {
      return {
        statusCode: existing.responseStatus,
        headers: { "Content-Type": "application/json" },
        body: existing.responseBody,
      };
    }
  }

  const body = validateBody(CreateProjectSchema, event.body ?? null);
  const projectId = ulid();
  const now = new Date().toISOString();

  await createProject({
    projectId,
    userId,
    title: body.title,
    theme: body.theme,
    audience: body.audience,
    duration: body.duration,
    urls: body.urls,
    status: "DRAFT",
    currentVersion: 0,
    createdAt: now,
    updatedAt: now,
  });

  const responseBody = JSON.stringify({
    projectId,
    userId,
    title: body.title,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
  });

  // Store idempotency response
  if (idempotencyKey) {
    await completeIdempotencyRecord(idempotencyKey, userId, 201, responseBody);
  }

  return buildResponse(201, {
    projectId,
    userId,
    title: body.title,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
  });
}
