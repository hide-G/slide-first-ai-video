/**
 * HTML composition template generation for Hyperframes.
 *
 * Generates an index.html following design section 11.1:
 * - Stage div with composition metadata attributes
 * - Slide images as clips with timing
 * - Audio elements with timing
 * - Caption overlay with synchronized text
 */

import type { VideoManifest, ManifestSlide, OutputConfig } from "@slide-first/shared-types";

export interface HtmlBuilderOptions {
  /** The manifest to render */
  manifest: VideoManifest;
  /** The output configuration to use */
  output: OutputConfig;
  /** Base prefix for asset URLs (e.g., S3 prefix or relative path) */
  assetsPrefix: string;
}

/**
 * Build the Hyperframes-compatible composition HTML.
 */
export function buildCompositionHtml(options: HtmlBuilderOptions): string {
  const { manifest, output, assetsPrefix } = options;

  const stageAttrs = buildStageAttributes(output);
  const clips = manifest.slides.map((slide) => buildSlideClip(slide, assetsPrefix));
  const audioElements = manifest.slides.map((slide) => buildAudioElement(slide, assetsPrefix));
  const captionOverlays = manifest.slides.map((slide) => buildCaptionOverlay(slide));

  return `<!DOCTYPE html>
<html lang="${manifest.locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${output.width}, height=${output.height}">
  <title>Composition: ${output.compositionId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    #stage { position: relative; overflow: hidden; background: #000; }
    .clip { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; }
    .caption-overlay {
      position: absolute;
      bottom: 10%;
      left: 5%;
      right: 5%;
      text-align: center;
      color: #fff;
      font-size: 2em;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="stage" ${stageAttrs}>
${clips.join("\n")}
${audioElements.join("\n")}
${captionOverlays.join("\n")}
  </div>
</body>
</html>`;
}

/**
 * Build stage element data attributes.
 */
function buildStageAttributes(output: OutputConfig): string {
  return [
    `data-composition-id="${output.compositionId}"`,
    `data-width="${output.width}"`,
    `data-height="${output.height}"`,
    `data-fps="${output.fps}"`,
  ].join(" ");
}

/**
 * Build an <img> clip element for a slide with timing attributes.
 */
function buildSlideClip(slide: ManifestSlide, assetsPrefix: string): string {
  const startSec = (slide.startMs / 1000).toFixed(3);
  const durationSec = (slide.durationMs / 1000).toFixed(3);
  const src = `${assetsPrefix}${slide.imageKey}`;

  return `    <img class="clip" src="${src}" data-start="${startSec}" data-duration="${durationSec}" data-slide="${slide.slideNumber}" alt="Slide ${slide.slideNumber}">`;
}

/**
 * Build an <audio> element for a slide with timing attributes.
 */
function buildAudioElement(slide: ManifestSlide, assetsPrefix: string): string {
  const startSec = (slide.startMs / 1000).toFixed(3);
  const durationSec = (slide.measuredAudioMs / 1000).toFixed(3);
  const src = `${assetsPrefix}${slide.voiceKey}`;

  return `    <audio src="${src}" data-start="${startSec}" data-duration="${durationSec}" data-slide="${slide.slideNumber}" preload="auto"></audio>`;
}

/**
 * Build a caption overlay div for a slide with timing attributes.
 */
function buildCaptionOverlay(slide: ManifestSlide): string {
  const startSec = (slide.startMs / 1000).toFixed(3);
  const durationSec = (slide.durationMs / 1000).toFixed(3);
  // Use first key point or truncated presenter note as caption text
  const captionText = slide.presenterNote.length > 100
    ? slide.presenterNote.substring(0, 100) + "..."
    : slide.presenterNote;

  return `    <div class="caption-overlay" data-start="${startSec}" data-duration="${durationSec}" data-slide="${slide.slideNumber}">${escapeHtml(captionText)}</div>`;
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
