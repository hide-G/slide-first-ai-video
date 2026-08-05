/**
 * Request validation middleware using Zod schemas.
 */

import { z } from "zod";

export const CreateProjectSchema = z.object({
  title: z.string().min(1).max(200),
  theme: z.string().min(1).max(100).optional(),
  audience: z.string().min(1).max(200).optional(),
  duration: z.number().positive().optional(),
  urls: z.array(z.string().url()).max(10).optional(),
});

export const StartSlidesSchema = z.object({
  theme: z.string().min(1).max(100).optional(),
  audience: z.string().min(1).max(200).optional(),
  duration: z.number().positive().optional(),
  urls: z.array(z.string().url()).max(10).optional(),
});

export const StartVideoSchema = z.object({
  versionNumber: z.number().int().positive(),
  outputTypes: z.array(z.string()).min(1).optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type StartSlidesInput = z.infer<typeof StartSlidesSchema>;
export type StartVideoInput = z.infer<typeof StartVideoSchema>;

/**
 * Validate a request body against a zod schema.
 * Returns the parsed data or throws an error with validation details.
 */
export function validateBody<T>(schema: z.ZodType<T>, body: string | null): T {
  if (!body) {
    throw new ValidationError("Request body is required");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new ValidationError("Invalid JSON in request body");
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const messages = result.error.errors.map(
      (e) => `${e.path.join(".")}: ${e.message}`,
    );
    throw new ValidationError(`Validation failed: ${messages.join(", ")}`);
  }

  return result.data;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
