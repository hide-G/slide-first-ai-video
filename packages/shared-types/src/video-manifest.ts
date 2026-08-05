/**
 * Video Manifest types.
 * The Marp Markdown is the source of truth for content.
 * The manifest holds only timing and rendering configuration.
 */

/** Voice configuration for TTS */
export interface VoiceConfig {
  voiceId: string;
  engine: string;
  sampleRate: string;
}

/** Output configuration for a specific video variant */
export interface OutputConfig {
  compositionId: string;
  width: number;
  height: number;
  fps: number;
  videoBitrateKbps: number;
  /** Target duration for teaser videos */
  targetDurationSec?: number;
  /** Hook text for teaser videos */
  hookText?: string;
  /** CTA text for teaser videos */
  ctaText?: string;
  /** Layout type (e.g., "slide-card" for 9:16) */
  layout?: string;
}

/** Caption configuration */
export interface CaptionsConfig {
  styleId: string;
  maxCharsPerLine: number;
  maxLines: number;
  minDurationMs: number;
  captionsKey: string;
  vttKey: string;
  srtKey: string;
}

/** Transition type */
export type TransitionType = "fade" | "slide" | "none";

/** Slide importance level */
export type SlideImportance = "HIGH" | "MEDIUM" | "LOW";

/** Individual slide within the manifest */
export interface ManifestSlide {
  slideNumber: number;
  imageKey: string;
  imageSha256: string;
  presenterNote: string;
  teaserNote: string;
  keyPoints: string[];
  voiceKey: string;
  speechMarksKey: string;
  measuredAudioMs: number;
  leadInMs: number;
  leadOutMs: number;
  /** durationMs = measuredAudioMs + leadInMs + leadOutMs */
  durationMs: number;
  /** Cumulative start position in milliseconds */
  startMs: number;
  transition: TransitionType;
  importance: SlideImportance;
  includeInXTeaser: boolean;
}

/**
 * Video Manifest (video-manifest.json).
 * Derived from Marp Markdown - holds timing information for video generation.
 */
export interface VideoManifest {
  schemaVersion: string;
  deckId: string;
  deckVersion: number;
  locale: string;
  voice: VoiceConfig;
  outputs: Record<string, OutputConfig>;
  captions: CaptionsConfig;
  slides: ManifestSlide[];
}
