import { NoteCompletenessResult } from "../types.js";

const MAX_NOTE_CHARS = 3000;

/**
 * Parse slides and their presenter notes from markdown.
 *
 * Marp format uses:
 * - `---` to separate slides
 * - `<!-- presenterNote: ... -->` for presenter notes
 * - `<!-- keyPoints: ["point1", "point2"] -->` for key points
 */
export interface ParsedSlide {
  index: number;
  title: string;
  presenterNote: string;
  keyPoints: string[];
}

/**
 * Parse a single slide to extract title, presenterNote, and keyPoints.
 */
function parseSlide(slideContent: string, index: number): ParsedSlide {
  const titleMatch = slideContent.match(/^#{1,3}\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : `Slide ${index + 1}`;

  // Extract presenterNote from HTML comment
  const noteMatch = slideContent.match(
    /<!--\s*presenterNote:\s*([\s\S]*?)\s*-->/,
  );
  const presenterNote = noteMatch ? noteMatch[1].trim() : "";

  // Extract keyPoints from HTML comment
  const keyPointsMatch = slideContent.match(
    /<!--\s*keyPoints:\s*(\[[\s\S]*?\])\s*-->/,
  );
  let keyPoints: string[] = [];
  if (keyPointsMatch) {
    try {
      keyPoints = JSON.parse(keyPointsMatch[1]) as string[];
    } catch {
      keyPoints = [];
    }
  }

  return { index, title, presenterNote, keyPoints };
}

/**
 * Check note completeness for all slides in a markdown deck.
 *
 * Verifies:
 * - Every slide has a non-empty presenterNote
 * - Every slide has keyPoints array with at least 1 item
 * - No presenterNote exceeds 3000 characters
 */
export function checkNoteCompleteness(markdown: string): NoteCompletenessResult {
  const slideContents = markdown.split(/^---$/m).map((s) => s.trim());

  // Filter out empty slides and front-matter (first slide if it starts with marp config)
  const slides = slideContents
    .filter((content) => {
      if (content.length === 0) return false;
      // Skip Marp front-matter (marp: true or similar config-only content)
      if (/^marp:\s*(true|false)/m.test(content) && !content.match(/^#{1,3}\s+/m)) {
        return false;
      }
      return true;
    })
    .map((content, idx) => parseSlide(content, idx));

  if (slides.length === 0) {
    return {
      totalSlides: 0,
      slidesWithNotes: 0,
      slidesWithKeyPoints: 0,
      oversizedNotes: [],
    };
  }

  let slidesWithNotes = 0;
  let slidesWithKeyPoints = 0;
  const oversizedNotes: string[] = [];

  for (const slide of slides) {
    if (slide.presenterNote.length > 0) {
      slidesWithNotes++;
    }

    if (slide.keyPoints.length > 0) {
      slidesWithKeyPoints++;
    }

    if (slide.presenterNote.length > MAX_NOTE_CHARS) {
      oversizedNotes.push(
        `${slide.title} (${slide.presenterNote.length} chars)`,
      );
    }
  }

  return {
    totalSlides: slides.length,
    slidesWithNotes,
    slidesWithKeyPoints,
    oversizedNotes,
  };
}
