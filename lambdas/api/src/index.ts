/**
 * API Lambda handler.
 * Single Lambda with path-based routing for API Gateway proxy integration.
 * Endpoints match section 5 of the spec exactly.
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { buildErrorResponse } from "./middleware/index.js";
import {
  handleCreateProject,
  handleListProjects,
  handleGenerateOutline,
  handleSaveOutline,
  handleGenerateDeck,
  handleSourceUploadUrl,
  handleRegisterSource,
  handleSaveOutput,
  handleGenerateNarration,
  handleSaveNarration,
  handleStartRender,
  handleGetRenderStatus,
  handleGetRenderArtifacts,
} from "./handlers/index.js";

type RouteHandler = (
  event: APIGatewayProxyEvent,
) => Promise<APIGatewayProxyResult>;

interface Route {
  method: string;
  pattern: RegExp;
  handler: RouteHandler;
  paramKeys: string[];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type,Authorization,X-Amz-Date,X-Api-Key,Idempotency-Key",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

const routes: Route[] = [
  // GET /projects - list user's projects
  {
    method: "GET",
    pattern: /^\/projects\/?$/,
    handler: handleListProjects,
    paramKeys: [],
  },
  // POST /projects - create project
  {
    method: "POST",
    pattern: /^\/projects\/?$/,
    handler: handleCreateProject,
    paramKeys: [],
  },
  // POST /projects/{id}/outline - generate outline
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/outline\/?$/,
    handler: handleGenerateOutline,
    paramKeys: ["id"],
  },
  // PUT /projects/{id}/outline - save confirmed outline
  {
    method: "PUT",
    pattern: /^\/projects\/([^/]+)\/outline\/?$/,
    handler: handleSaveOutline,
    paramKeys: ["id"],
  },
  // POST /projects/{id}/deck - generate slides
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/deck\/?$/,
    handler: handleGenerateDeck,
    paramKeys: ["id"],
  },
  // POST /projects/{id}/source-upload-url - get presigned upload URL
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/source-upload-url\/?$/,
    handler: handleSourceUploadUrl,
    paramKeys: ["id"],
  },
  // POST /projects/{id}/source - register uploaded source
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/source\/?$/,
    handler: handleRegisterSource,
    paramKeys: ["id"],
  },
  // PUT /projects/{id}/output - save output settings
  {
    method: "PUT",
    pattern: /^\/projects\/([^/]+)\/output\/?$/,
    handler: handleSaveOutput,
    paramKeys: ["id"],
  },
  // POST /projects/{id}/narration - generate narration drafts
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/narration\/?$/,
    handler: handleGenerateNarration,
    paramKeys: ["id"],
  },
  // PUT /projects/{id}/narration - save confirmed narration + lexicon
  {
    method: "PUT",
    pattern: /^\/projects\/([^/]+)\/narration\/?$/,
    handler: handleSaveNarration,
    paramKeys: ["id"],
  },
  // POST /projects/{id}/renders - start render pipeline
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/renders\/?$/,
    handler: handleStartRender,
    paramKeys: ["id"],
  },
  // GET /projects/{id}/renders/{renderId} - get render status
  {
    method: "GET",
    pattern: /^\/projects\/([^/]+)\/renders\/([^/]+)\/?$/,
    handler: handleGetRenderStatus,
    paramKeys: ["id", "renderId"],
  },
  // GET /projects/{id}/renders/{renderId}/artifacts - get artifacts
  {
    method: "GET",
    pattern: /^\/projects\/([^/]+)\/renders\/([^/]+)\/artifacts\/?$/,
    handler: handleGetRenderArtifacts,
    paramKeys: ["id", "renderId"],
  },
];

/**
 * Normalize the path by removing the API Gateway stage prefix and /v1 prefix.
 */
function normalizePath(path: string, stage: string): string {
  let normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const stagePrefix = `/${stage}`;

  if (
    stage &&
    stage !== "$default" &&
    (normalizedPath === stagePrefix ||
      normalizedPath.startsWith(`${stagePrefix}/`))
  ) {
    normalizedPath = normalizedPath.slice(stagePrefix.length) || "/";
  }

  if (normalizedPath === "/v1") {
    return "/";
  }

  if (normalizedPath.startsWith("/v1/")) {
    return normalizedPath.slice("/v1".length);
  }

  return normalizedPath;
}

/**
 * Add CORS headers to any response.
 */
function withCorsHeaders(
  response: APIGatewayProxyResult,
): APIGatewayProxyResult {
  return {
    ...response,
    headers: {
      ...response.headers,
      ...corsHeaders,
    },
  };
}

/**
 * Match a request to a route handler.
 */
function matchRoute(
  method: string,
  path: string,
): { handler: RouteHandler; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method) continue;

    const match = path.match(route.pattern);
    if (match) {
      const params: Record<string, string> = {};
      route.paramKeys.forEach((key, index) => {
        params[key] = match[index + 1];
      });
      return { handler: route.handler, params };
    }
  }

  return null;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  _context: Context,
): Promise<APIGatewayProxyResult> => {
  try {
    const path = normalizePath(event.path, event.requestContext.stage);
    const matched = matchRoute(event.httpMethod, path);

    if (!matched) {
      return withCorsHeaders({
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "NOT_FOUND",
          message: `No route matches ${event.httpMethod} ${path}`,
        }),
      });
    }

    event.pathParameters = {
      ...(event.pathParameters ?? {}),
      ...matched.params,
    };

    return withCorsHeaders(await matched.handler(event));
  } catch (error) {
    return withCorsHeaders(buildErrorResponse(error));
  }
};
