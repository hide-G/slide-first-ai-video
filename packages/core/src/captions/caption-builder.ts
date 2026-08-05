/**
 * Caption builder: groups word-level speech marks into caption segments.
 *
 * Rules (from design section 10.6):
 * - Max 20 characters per line
 * - Max 2 lines per caption segment
 * - Min 1200ms display time
 * - keyPoints words are marked for highlight
 */

import type { SpeechMark } from "./speech-marks-parser.js";

export interface CaptionSegment {
  text: string;
  startMs: number;
  endMs: number;
  highlight: string[];
}

export interface CaptionBuilderOptions {
  maxCharsPerLine?: number;
  maxLines?: number;
  minDurationMs?: number;
  keyPoints?: string[];
}

const DEFAULT_OPTIONS: Required<CaptionBuilderOptions> = {
  maxCharsPerLine: 20,
  maxLines: 2,
  minDurationMs: 1200,
  keyPoints: [],
};

/**
 * Build caption segments from word-level speech marks.
 *
 * Groups words into lines respecting character limits,
 * then groups lines into segments respecting line count limits.
 * Enforces minimum display duration by merging short segments.
 */
export function buildCaptions(
  wordMarks: SpeechMark[],
  totalDurationMs: number,
  options?: CaptionBuilderOptions,
): CaptionSegment[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (wordMarks.length === 0) {
    return [];
  }

  // Normalize keyPoints to lowercase for case-insensitive matching
  const keyPointsLower = opts.keyPoints.map((kp) => kp.toLowerCase());

  // Group words into raw segments based on character limits
  const rawSegments = groupWordsIntoSegments(wordMarks, totalDurationMs, opts);

  // Enforce minimum duration by merging short segments
  const merged = enforceMinDuration(rawSegments, opts);

  // Mark highlights based on keyPoints
  return merged.map((seg) => ({
    ...seg,
    highlight: findHighlights(seg.text, keyPointsLower),
  }));
}

interface RawSegment {
  words: SpeechMark[];
  text: string;
  startMs: number;
  endMs: number;
}

function groupWordsIntoSegments(
  wordMarks: SpeechMark[],
  totalDurationMs: number,
  opts: Required<CaptionBuilderOptions>,
): RawSegment[] {
  const segments: RawSegment[] = [];
  let currentLines: string[] = [];
  let currentWords: SpeechMark[] = [];
  let currentLineText = "";

  for (let i = 0; i < wordMarks.length; i++) {
    const word = wordMarks[i];
    const wordValue = word.value;

    // Check if adding this word would exceed the line character limit
    const proposedLine =
      currentLineText.length === 0
        ? wordValue
        : `${currentLineText} ${wordValue}`;

    if (proposedLine.length <= opts.maxCharsPerLine) {
      // Word fits on the current line
      currentLineText = proposedLine;
      currentWords.push(word);
    } else if (currentLines.length < opts.maxLines - 1) {
      // Start a new line within the same segment
      if (currentLineText.length > 0) {
        currentLines.push(currentLineText);
      }
      currentLineText = wordValue;
      currentWords.push(word);
    } else {
      // We've hit max lines and the word doesn't fit - finalize this segment
      if (currentLineText.length > 0) {
        currentLines.push(currentLineText);
      }

      if (currentWords.length > 0) {
        const startMs = currentWords[0].time;
        const endMs = word.time; // Next word's start is this segment's end
        segments.push({
          words: [...currentWords],
          text: currentLines.join("\n"),
          startMs,
          endMs,
        });
      }

      // Start fresh with the current word
      currentLines = [];
      currentLineText = wordValue;
      currentWords = [word];
    }
  }

  // Finalize the last segment
  if (currentWords.length > 0) {
    if (currentLineText.length > 0) {
      currentLines.push(currentLineText);
    }
    const startMs = currentWords[0].time;
    const endMs = totalDurationMs;
    segments.push({
      words: [...currentWords],
      text: currentLines.join("\n"),
      startMs,
      endMs,
    });
  }

  return segments;
}

function enforceMinDuration(
  segments: RawSegment[],
  opts: Required<CaptionBuilderOptions>,
): CaptionSegment[] {
  if (segments.length === 0) return [];

  const result: CaptionSegment[] = [];
  let pendingSegment: RawSegment | null = null;

  for (const seg of segments) {
    if (pendingSegment === null) {
      pendingSegment = seg;
    } else {
      const pendingDuration = seg.startMs - pendingSegment.startMs;
      if (pendingDuration >= opts.minDurationMs) {
        // The pending segment has sufficient duration, emit it
        result.push({
          text: pendingSegment.text,
          startMs: pendingSegment.startMs,
          endMs: seg.startMs,
          highlight: [],
        });
        pendingSegment = seg;
      } else {
        // Merge into pending by extending its text and words
        const mergedText: string = pendingSegment.text + "\n" + seg.text;
        // Truncate to max lines
        const lines: string[] = mergedText.split("\n").slice(0, opts.maxLines);
        pendingSegment = {
          words: [...pendingSegment.words, ...seg.words],
          text: lines.join("\n"),
          startMs: pendingSegment.startMs,
          endMs: seg.endMs,
        };
      }
    }
  }

  // Emit the final pending segment
  if (pendingSegment !== null) {
    result.push({
      text: pendingSegment.text,
      startMs: pendingSegment.startMs,
      endMs: pendingSegment.endMs,
      highlight: [],
    });
  }

  return result;
}

/**
 * Find words in the text that match keyPoints (case-insensitive).
 */
function findHighlights(text: string, keyPointsLower: string[]): string[] {
  if (keyPointsLower.length === 0) return [];

  const highlights: string[] = [];
  const words = text.replace(/\n/g, " ").split(/\s+/);

  for (const word of words) {
    const wordLower = word.toLowerCase();
    for (const kp of keyPointsLower) {
      if (wordLower.includes(kp) || kp.includes(wordLower)) {
        if (!highlights.includes(word)) {
          highlights.push(word);
        }
        break;
      }
    }
  }

  return highlights;
}
