/**
 * Error response formatting middleware.
 */

import type { APIGatewayProxyResult } from "aws-lambda";
import { ValidationError } from "./validation.js";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errorCode: string = "INTERNAL_ERROR",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = "Resource not found") {
    super(404, message, "NOT_FOUND");
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = "Access denied") {
    super(403, message, "FORBIDDEN");
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = "Unauthorized") {
    super(401, message, "UNAUTHORIZED");
  }
}

export class ConflictError extends ApiError {
  constructor(message: string = "Resource conflict") {
    super(409, message, "CONFLICT");
  }
}

/**
 * Build an error response from any error type.
 */
export function buildErrorResponse(error: unknown): APIGatewayProxyResult {
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: error.errorCode,
        message: error.message,
      }),
    };
  }

  if (error instanceof ValidationError) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "VALIDATION_ERROR",
        message: error.message,
      }),
    };
  }

  // Unknown error
  const message =
    error instanceof Error ? error.message : "Internal server error";
  return {
    statusCode: 500,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error: "INTERNAL_ERROR",
      message,
    }),
  };
}

/**
 * Build a successful JSON response.
 */
export function buildResponse(
  statusCode: number,
  body: unknown,
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
