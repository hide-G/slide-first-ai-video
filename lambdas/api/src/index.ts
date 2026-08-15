/**
 * API Lambda handler.
 * Single Lambda with path-based routing for API Gateway proxy integration.
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from "aws-lambda";
import { buildErrorResponse } from "./middleware/index.js";
import {
  handleCreateProject,
  handleStartSlides,
  handleGetVersion,
  handleApprove,
  handleStartVideo,
  handleStartTeaser,
  handleGetJob,
  handleGetDeliverables,
} from "./handlers/index.js";

type RouteHandler = (
  event: APIGatewayProxyEventV2,
) => Promise<APIGatewayProxyResultV2>;

interface Route {
  method: string;
  pattern: RegExp;
  handler: RouteHandler;
  /** Named parameter keys extracted from the pattern */
  paramKeys: string[];
}

const routes: Route[] = [
  {
    method: "POST",
    pattern: /^\/v1\/projects\/?$/,
    handler: handleCreateProject,
    paramKeys: [],
  },
  {
    method: "POST",
    pattern: /^\/v1\/projects\/([^/]+)\/slides\/?$/,
    handler: handleStartSlides,
    paramKeys: ["id"],
  },
  {
    method: "GET",
    pattern: /^\/v1\/projects\/([^/]+)\/versions\/([^/]+)\/?$/,
    handler: handleGetVersion,
    paramKeys: ["id", "version"],
  },
  {
    method: "POST",
    pattern: /^\/v1\/projects\/([^/]+)\/versions\/([^/]+)\/approve\/?$/,
    handler: handleApprove,
    paramKeys: ["id", "version"],
  },
  {
    method: "POST",
    pattern: /^\/v1\/projects\/([^/]+)\/videos\/teaser\/?$/,
    handler: handleStartTeaser,
    paramKeys: ["id"],
  },
  {
    method: "POST",
    pattern: /^\/v1\/projects\/([^/]+)\/videos\/?$/,
    handler: handleStartVideo,
    paramKeys: ["id"],
  },
  {
    method: "GET",
    pattern: /^\/v1\/jobs\/([^/]+)\/?$/,
    handler: handleGetJob,
    paramKeys: ["jobId"],
  },
  {
    method: "GET",
    pattern: /^\/v1\/projects\/([^/]+)\/deliverables\/?$/,
    handler: handleGetDeliverables,
    paramKeys: ["id"],
  },
];

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
  event: APIGatewayProxyEventV2,
  _context: Context,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const method = event.requestContext.http.method;
    const path = event.rawPath;

    const matched = matchRoute(method, path);
    if (!matched) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "NOT_FOUND",
          message: `No route matches ${method} ${path}`,
        }),
      };
    }

    // Inject extracted path parameters
    event.pathParameters = {
      ...event.pathParameters,
      ...matched.params,
    };

    return await matched.handler(event);
  } catch (error) {
    return buildErrorResponse(error);
  }
};
