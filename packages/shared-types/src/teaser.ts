/**
 * Types for teaser (X short video) generation.
 */

import type { ManifestSlide } from "./video-manifest.js";

/** Configuration for teaser generation */
export interface TeaserConfig {
  /** Minimum number of slides to include */
  minSlides: number;
  /** Maximum number of slides to include */
  maxSlides: number;
  /** Target duration range in seconds */
  targetDurationMinSec: number;
  targetDurationMaxSec: number;
  /** Number of hook text candidates to generate */
  hookCandidateCount: number;
}

/** A candidate hook text for the teaser intro */
export interface HookTextCandidate {
  /** The hook text content */
  text: string;
  /** Estimated reading time in milliseconds */
  estimatedReadingTimeMs: number;
  /** Ranking score (1 = best) */
  rank: number;
}

/** Result of slide selection for teaser */
export interface SelectedSlide {
  slideNumber: number;
  teaserNote: string;
  keyPoints: string[];
  imageKey: string;
  estimatedDurationMs: number;
}

/** Post text for X (Twitter) */
export interface PostText {
  /** The main post text */
  text: string;
  /** Hashtags included in the post */
  hashtags: string[];
  /** Source page links referenced in the slides */
  sourceLinks: string[];
}

/** Complete result from the teaser generator Lambda */
export interface TeaserGenerationResult {
  /** Selected slides for the teaser */
  selectedSlides: SelectedSlide[];
  /** Hook text candidates */
  hookCandidates: HookTextCandidate[];
  /** Generated post text */
  postText: PostText;
  /** Total estimated teaser duration in milliseconds */
  totalDurationMs: number;
  /** Token usage info */
  inputTokens?: number;
  outputTokens?: number;
}

/** Layout configuration for 9:16 slide-card */
export interface SlideCardLayout {
  /** Total width in pixels */
  width: number;
  /** Total height in pixels */
  height: number;
  /** Top area for the 16:9 slide image */
  slideArea: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  /** Bottom area for keyPoints and caption */
  captionArea: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

/** Input event for the teaser generator Lambda */
export interface TeaserGeneratorEvent {
  projectId: string;
  userId: string;
  versionNumber: number;
  jobId: string;
  s3Bucket: string;
  s3Prefix: string;
  /** Full manifest slides for selection */
  slides: ManifestSlide[];
  /** Optional references/URLs from the original slides */
  references?: string[];
}

/** Input event for the teaser composition builder Lambda */
export interface TeaserCompositionBuilderEvent {
  projectId: string;
  userId: string;
  versionNumber: number;
  jobId: string;
  s3Bucket: string;
  s3Prefix: string;
  assetsPrefix: string;
  /** Selected slides from teaser-generator */
  selectedSlides: SelectedSlide[];
  /** Chosen hook text */
  hookText: string;
  /** CTA text for the end */
  ctaText?: string;
  /** Output layout: "16x9" or "9x16" */
  layout: "16x9" | "9x16";
}

/** Result from the teaser composition builder Lambda */
export interface TeaserCompositionBuilderResult {
  compositionKey: string;
  totalSlides: number;
  totalDurationMs: number;
  layout: "16x9" | "9x16";
}
