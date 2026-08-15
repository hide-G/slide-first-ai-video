/**
 * API Lambda handler.
 * Single Lambda with path-based routing for API Gateway proxy integration.
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
  handleStartSlides,
  handleGetVersion,
  handleApprove,
  handleStartVideo,
  handleStartTeaser,
  handleGetJob,
  handleGetDeliverables,
} from "./handlers/index.js";

type RouteHandler = (
  event: APIGatewayProxyEvent,
) => Promise<APIGatewayProxyResult>;

interface Route {
  method: string;
  pattern: RegExp;
  handler: RouteHandler;
  /** 正規表現から抽出する名前付きパスパラメータ */
  paramKeys: string[];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type,Authorization,X-Amz-Date,X-Api-Key,Idempotency-Key",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

const routes: Route[] = [
  {
    method: "GET",
    pattern: /^\/projects\/?$/,
    handler: handleListProjects,
    paramKeys: [],
  },
  {
    method: "POST",
    pattern: /^\/projects\/?$/,
    handler: handleCreateProject,
    paramKeys: [],
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/slides\/?$/,
    handler: handleStartSlides,
    paramKeys: ["id"],
  },
  {
    method: "GET",
    pattern: /^\/projects\/([^/]+)\/versions\/([^/]+)\/?$/,
    handler: handleGetVersion,
    paramKeys: ["id", "version"],
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/versions\/([^/]+)\/approve\/?$/,
    handler: handleApprove,
    paramKeys: ["id", "version"],
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/videos\/teaser\/?$/,
    handler: handleStartTeaser,
    paramKeys: ["id"],
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/videos\/?$/,
    handler: handleStartVideo,
    paramKeys: ["id"],
  },
  {
    method: "GET",
    pattern: /^\/jobs\/([^/]+)\/?$/,
    handler: handleGetJob,
    paramKeys: ["jobId"],
  },
  {
    method: "GET",
    pattern: /^\/projects\/([^/]+)\/deliverables\/?$/,
    handler: handleGetDeliverables,
    paramKeys: ["id"],
  },
];

/**
 * REST APIイベントのstageと任意の/v1プレフィックスを除去して、
 * APIリソースのパスへ正規化する。
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
 * ルート処理結果へCORSヘッダーを必ず追加する。
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
 * リクエストをルートhandlerへ照合する。
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
