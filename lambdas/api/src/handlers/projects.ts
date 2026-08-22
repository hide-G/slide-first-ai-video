/**
 * Project API handlers: POST /projects, GET /projects
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ulid } from "ulid";
import {
  requireAuth,
  validateBody,
  CreateProjectSchema,
  buildResponse,
} from "../middleware/index.js";
import { createProject, listProjectsByUser } from "../db/index.js";

export async function handleListProjects(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = requireAuth(event);

  const nextToken = event.queryStringParameters?.nextToken;
  const { projects, nextToken: resultToken } = await listProjectsByUser(userId, nextToken);

  return buildResponse(200, {
    projects: projects.map((project) => ({
      projectId: project.projectId,
      title: project.title,
      kind: project.kind,
      status: project.status,
      latestRender: project.latestRender,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    })),
    ...(resultToken ? { nextToken: resultToken } : {}),
  });
}

export async function handleCreateProject(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = requireAuth(event);

  const body = validateBody(CreateProjectSchema, event.body ?? null);
  const projectId = ulid();
  const now = new Date().toISOString();
  const project = {
    projectId,
    userId,
    title: body.title,
    kind: body.kind ?? "video",
    contentLanguage: body.contentLanguage,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
  };

  await createProject(project);

  return buildResponse(201, { project });
}
