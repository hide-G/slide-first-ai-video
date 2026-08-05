export { parseSpeechMarks, getWordMarks } from "./speech-marks-parser.js";
export type { SpeechMark } from "./speech-marks-parser.js";

export { buildCaptions } from "./caption-builder.js";
export type {
  CaptionSegment,
  CaptionBuilderOptions,
} from "./caption-builder.js";

export { generateVtt, formatVttTimestamp } from "./vtt-generator.js";
export { generateSrt, formatSrtTimestamp } from "./srt-generator.js";
