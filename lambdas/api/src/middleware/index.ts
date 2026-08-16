export { extractUserId, requireAuth, verifyProjectOwnership } from "./auth.js";
export { extractIdempotencyKey } from "./idempotency.js";
export {
  validateBody,
  CreateProjectSchema,
  GenerateOutlineSchema,
  SaveOutlineSchema,
  GenerateDeckSchema,
  SourceUploadUrlSchema,
  RegisterSourceSchema,
  SaveOutputSchema,
  GenerateNarrationSchema,
  SaveNarrationSchema,
  StartRenderSchema,
  ValidationError,
} from "./validation.js";
export type {
  CreateProjectInput,
  GenerateOutlineInput,
  SaveOutlineInput,
  GenerateDeckInput,
  SourceUploadUrlInput,
  RegisterSourceInput,
  SaveOutputInput,
  GenerateNarrationInput,
  SaveNarrationInput,
  StartRenderInput,
} from "./validation.js";
export {
  buildErrorResponse,
  buildResponse,
  ApiError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  ConflictError,
} from "./errors.js";
