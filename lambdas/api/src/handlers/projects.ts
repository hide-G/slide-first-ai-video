/**
 * Project API handlers.
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
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
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = extractUserId(event);
  if (!userId) {
    throw new UnauthorizedError();
  }

  const nextToken = event.queryStringParameters?.nextToken;
  const { projects, nextToken: resultToken } = await listProjectsByUser(
    userId,
    nextToken,
  );

  return buildResponse(200, {
    projects: projects.map((project) => ({
      projectId: project.projectId,
      userId: project.userId,
      title: project.title,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    })),
    ...(resultToken ? { nextToken: resultToken } : {}),
  });
}

export async function handleCreateProject(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = extractUserId(event);
  if (!userId) {
    throw new UnauthorizedError();
  }

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
  const project = {
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
  };

  await createProject(project);

  const response = { project };
  const responseBody = JSON.stringify(response);

  if (idempotencyKey) {
    await completeIdempotencyRecord(idempotencyKey, userId, 201, responseBody);
  }

  return buildResponse(201, response);
}
