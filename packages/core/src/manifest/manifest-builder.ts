/**
 * Manifest builder: constructs a full VideoManifest from slide generation results,
 * audio results, and timing data.
 */

import type {
  VideoManifest,
  ManifestSlide,
  VoiceConfig,
  OutputConfig,
  CaptionsConfig,
  TransitionType,
  SlideImportance,
} from "@slide-first/shared-types";

import { resolveTimings } from "./timing-resolver.js";

/** Input data for a single slide */
export interface SlideInput {
  slideNumber: number;
  imageKey: string;
  imageSha256: string;
  presenterNote: string;
  teaserNote: string;
  keyPoints: string[];
  voiceKey: string;
  speechMarksKey: string;
  measuredAudioMs: number;
  leadInMs?: number;
  leadOutMs?: number;
  transition?: TransitionType;
  importance?: SlideImportance;
  includeInXTeaser?: boolean;
}

/** Top-level manifest configuration */
export interface ManifestConfig {
  schemaVersion: string;
  deckId: string;
  deckVersion: number;
  locale: string;
  voice: VoiceConfig;
  outputs: Record<string, OutputConfig>;
  captions: CaptionsConfig;
}

/**
 * Build a complete VideoManifest from slide inputs and configuration.
 *
 * Resolves timing (durationMs, startMs) using the timing resolver,
 * then assembles the complete manifest object.
 */
export function buildManifest(
  config: ManifestConfig,
  slideInputs: SlideInput[],
): VideoManifest {
  // Resolve timings for all slides
  const timings = resolveTimings(
    slideInputs.map((s) => ({
      measuredAudioMs: s.measuredAudioMs,
      leadInMs: s.leadInMs,
      leadOutMs: s.leadOutMs,
    })),
  );

  // Build manifest slides
  const slides: ManifestSlide[] = slideInputs.map((input, index) => {
    const timing = timings[index];
    return {
      slideNumber: input.slideNumber,
      imageKey: input.imageKey,
      imageSha256: input.imageSha256,
      presenterNote: input.presenterNote,
      teaserNote: input.teaserNote,
      keyPoints: input.keyPoints,
      voiceKey: input.voiceKey,
      speechMarksKey: input.speechMarksKey,
      measuredAudioMs: timing.measuredAudioMs,
      leadInMs: timing.leadInMs,
      leadOutMs: timing.leadOutMs,
      durationMs: timing.durationMs,
      startMs: timing.startMs,
      transition: input.transition ?? "fade",
      importance: input.importance ?? "MEDIUM",
      includeInXTeaser: input.includeInXTeaser ?? false,
    };
  });

  return {
    schemaVersion: config.schemaVersion,
    deckId: config.deckId,
    deckVersion: config.deckVersion,
    locale: config.locale,
    voice: config.voice,
    outputs: config.outputs,
    captions: config.captions,
    slides,
  };
}
