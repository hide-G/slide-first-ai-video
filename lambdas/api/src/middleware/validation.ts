/**
 * Request validation middleware using Zod schemas.
 */

import { z } from "zod";

export const CreateProjectSchema = z.object({
  title: z.string().min(1).max(200),
  contentLanguage: z.string().min(1).max(10).optional(),
});

export const GenerateOutlineSchema = z.object({
  topic: z.string().min(1).max(500),
  sourceText: z.string().max(50000).optional(),
  referenceUrls: z.array(z.string().url()).max(10).optional(),
  audience: z.string().min(1).max(200).optional(),
  pages: z.number().int().min(1).max(50).optional(),
  tone: z.string().min(1).max(100).optional(),
  theme: z.string().min(1).max(100).optional(),
  contentLanguage: z.string().min(1).max(10).optional(),
});

export const SaveOutlineSchema = z.object({
  outline: z.array(
    z.object({
      pageNumber: z.number().int().positive(),
      title: z.string().min(1),
      bullets: z.array(z.string()).optional(),
      presenterNotes: z.string().optional(),
    }),
  ),
});

export const GenerateDeckSchema = z.object({
  theme: z.string().min(1).max(100).optional(),
});

export const SourceUploadUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
});

export const RegisterSourceSchema = z.object({
  kind: z.enum(["generated", "uploaded"]),
  fileKey: z.string().min(1),
  pageCount: z.number().int().positive(),
});

export const SaveOutputSchema = z.object({
  aspect: z.enum(["16:9", "9:16", "1:1", "4:5"]),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
  captions: z.enum(["burn", "srt", "none"]),
  verticalLayout: z.string().nullable().optional(),
  padColor: z.string().nullable().optional(),
});

export const GenerateNarrationSchema = z.object({
  voiceId: z.string().min(1).optional(),
  engine: z.string().min(1).optional(),
  languageCode: z.string().min(1).optional(),
});

export const SaveNarrationSchema = z.object({
  scripts: z.array(
    z.object({
      pageNumber: z.number().int().positive(),
      mode: z.enum(["plain", "ssml"]),
      text: z.string(),
    }),
  ),
  lexicon: z
    .array(
      z.object({
        written: z.string().min(1),
        reading: z.string().min(1),
        method: z.enum(["sub", "phoneme", "spell"]),
      }),
    )
    .optional(),
  voice: z
    .object({
      id: z.string().min(1),
      engine: z.string().min(1),
      languageCode: z.string().min(1),
      sampleRate: z.string().min(1),
    })
    .optional(),
});

export const StartRenderSchema = z.object({
  startFromStage: z.enum(["pages", "audio", "captions", "video"]).optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type GenerateOutlineInput = z.infer<typeof GenerateOutlineSchema>;
export type SaveOutlineInput = z.infer<typeof SaveOutlineSchema>;
export type GenerateDeckInput = z.infer<typeof GenerateDeckSchema>;
export type SourceUploadUrlInput = z.infer<typeof SourceUploadUrlSchema>;
export type RegisterSourceInput = z.infer<typeof RegisterSourceSchema>;
export type SaveOutputInput = z.infer<typeof SaveOutputSchema>;
export type GenerateNarrationInput = z.infer<typeof GenerateNarrationSchema>;
export type SaveNarrationInput = z.infer<typeof SaveNarrationSchema>;
export type StartRenderInput = z.infer<typeof StartRenderSchema>;

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
