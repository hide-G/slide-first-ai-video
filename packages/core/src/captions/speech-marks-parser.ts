/**
 * Polly speech marks parser.
 *
 * Polly speech marks format: one JSON object per line (JSONL).
 * Each line contains: { time, type, start, end, value }
 * - time: offset in ms from the start of the audio
 * - type: 'word' | 'sentence' | 'viseme' | 'ssml'
 * - start: character offset in the input text
 * - end: character offset in the input text
 * - value: the text content
 */

export interface SpeechMark {
  time: number;
  type: "word" | "sentence" | "viseme" | "ssml";
  start: number;
  end: number;
  value: string;
}

/**
 * Parse Polly speech marks from JSONL content.
 * Each line is a JSON object representing a speech mark.
 * Empty lines are skipped.
 */
export function parseSpeechMarks(content: string): SpeechMark[] {
  const lines = content.split("\n").filter((line) => line.trim().length > 0);
  return lines.map((line) => {
    const parsed = JSON.parse(line) as SpeechMark;
    return {
      time: parsed.time,
      type: parsed.type,
      start: parsed.start,
      end: parsed.end,
      value: parsed.value,
    };
  });
}

/**
 * Filter speech marks to only word-type marks.
 */
export function getWordMarks(marks: SpeechMark[]): SpeechMark[] {
  return marks.filter((m) => m.type === "word");
}
