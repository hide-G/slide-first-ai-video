/**
 * Slide validation module.
 * Validates generated slides against constraints from design section 19.1:
 * - Slide count reasonable for duration (1 slide per 15-20 seconds)
 * - All slides have presenter notes
 * - All slides have keyPoints array
 * - Presenter notes <= 3000 chars per slide (Polly limit)
 * - No oversized text overflow
 * - Marp frontmatter present
 */

import type { ParsedSlide, SlideMetadata } from "./parser.js";

/** Maximum presenter note length (Polly TTS character limit) */
export const MAX_PRESENTER_NOTE_CHARS = 3000;

/** Minimum seconds per slide for duration estimation */
const MIN_SECONDS_PER_SLIDE = 15;

/** Maximum seconds per slide for duration estimation */
const MAX_SECONDS_PER_SLIDE = 20;

/** Maximum characters per slide content (prevents overflow) */
const MAX_SLIDE_CONTENT_CHARS = 1500;

/** Validation error detail */
export interface ValidationError {
  slideNumber: number;
  field: string;
  message: string;
}

/** Validation result */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Validate parsed slides and metadata against all constraints.
 */
export function validateSlides(
  slides: ParsedSlide[],
  metadata: SlideMetadata[],
  frontmatter: string,
  durationMinutes: number,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Validate frontmatter
  validateFrontmatter(frontmatter, errors);

  // Validate slide count for duration
  validateSlideCount(slides.length, durationMinutes, errors, warnings);

  // Validate each slide
  for (const slide of slides) {
    validateSlidePresenterNote(slide, errors);
    validateSlideContentLength(slide, warnings);
  }

  // Validate metadata coverage
  validateMetadataCoverage(slides, metadata, errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate Marp frontmatter is present and contains required fields.
 */
function validateFrontmatter(frontmatter: string, errors: ValidationError[]): void {
  if (!frontmatter) {
    errors.push({
      slideNumber: 0,
      field: "frontmatter",
      message: "Marp frontmatter is missing",
    });
    return;
  }

  if (!frontmatter.includes("marp")) {
    errors.push({
      slideNumber: 0,
      field: "frontmatter",
      message: "Frontmatter must include 'marp: true'",
    });
  }
}

/**
 * Validate slide count is reasonable for the target duration.
 */
function validateSlideCount(
  slideCount: number,
  durationMinutes: number,
  errors: ValidationError[],
  warnings: ValidationError[],
): void {
  const totalSeconds = durationMinutes * 60;
  const minSlides = Math.max(1, Math.floor(totalSeconds / MAX_SECONDS_PER_SLIDE));
  const maxSlides = Math.ceil(totalSeconds / MIN_SECONDS_PER_SLIDE);

  if (slideCount < minSlides) {
    warnings.push({
      slideNumber: 0,
      field: "slideCount",
      message: `Slide count (${slideCount}) is below expected minimum (${minSlides}) for ${durationMinutes} minute duration`,
    });
  }

  if (slideCount > maxSlides * 1.5) {
    errors.push({
      slideNumber: 0,
      field: "slideCount",
      message: `Slide count (${slideCount}) far exceeds maximum (${maxSlides}) for ${durationMinutes} minute duration`,
    });
  }
}

/**
 * Validate that a slide has a presenter note within character limits.
 */
function validateSlidePresenterNote(slide: ParsedSlide, errors: ValidationError[]): void {
  if (!slide.presenterNote || slide.presenterNote.length === 0) {
    errors.push({
      slideNumber: slide.slideNumber,
      field: "presenterNote",
      message: "Slide is missing presenter note",
    });
    return;
  }

  if (slide.presenterNote.length > MAX_PRESENTER_NOTE_CHARS) {
    errors.push({
      slideNumber: slide.slideNumber,
      field: "presenterNote",
      message: `Presenter note exceeds ${MAX_PRESENTER_NOTE_CHARS} character limit (${slide.presenterNote.length} chars)`,
    });
  }
}

/**
 * Validate slide content is not oversized (prevents visual overflow).
 */
function validateSlideContentLength(slide: ParsedSlide, warnings: ValidationError[]): void {
  if (slide.content.length > MAX_SLIDE_CONTENT_CHARS) {
    warnings.push({
      slideNumber: slide.slideNumber,
      field: "content",
      message: `Slide content may overflow (${slide.content.length} chars exceeds ${MAX_SLIDE_CONTENT_CHARS} recommended max)`,
    });
  }
}

/**
 * Validate that metadata covers all slides with keyPoints.
 */
function validateMetadataCoverage(
  slides: ParsedSlide[],
  metadata: SlideMetadata[],
  errors: ValidationError[],
): void {
  // Build a map of metadata by slide number
  const metadataMap = new Map<number, SlideMetadata>();
  for (const m of metadata) {
    metadataMap.set(m.slideNumber, m);
  }

  for (const slide of slides) {
    const slideMeta = metadataMap.get(slide.slideNumber);
    if (!slideMeta) {
      errors.push({
        slideNumber: slide.slideNumber,
        field: "metadata",
        message: "Slide is missing metadata entry (keyPoints, importance, teaserNote)",
      });
      continue;
    }

    if (!slideMeta.keyPoints || slideMeta.keyPoints.length === 0) {
      errors.push({
        slideNumber: slide.slideNumber,
        field: "keyPoints",
        message: "Slide is missing keyPoints array",
      });
    }
  }
}
