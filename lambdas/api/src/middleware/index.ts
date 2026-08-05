export { extractUserId } from "./auth.js";
export { extractIdempotencyKey } from "./idempotency.js";
export {
  validateBody,
  CreateProjectSchema,
  StartSlidesSchema,
  StartVideoSchema,
  ValidationError,
} from "./validation.js";
export type { CreateProjectInput, StartSlidesInput, StartVideoInput } from "./validation.js";
export {
  buildErrorResponse,
  buildResponse,
  ApiError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  ConflictError,
} from "./errors.js";
