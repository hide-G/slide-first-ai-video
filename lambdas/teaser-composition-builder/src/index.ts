/**
 * Teaser Composition Builder Lambda handler.
 * Builds Hyperframes-compatible index.html for teaser videos.
 * Supports both 16:9 (standard) and 9:16 (slide-card) layouts.
 *
 * Structure:
 * - Hook text overlay (first 2 seconds)
 * - Selected slides with teaserNote audio
 * - CTA text at the end (last 3 seconds)
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type {
  TeaserCompositionBuilderEvent,
  TeaserCompositionBuilderResult,
  SelectedSlide,
} from "@slide-first/shared-types";
import { calculateSlideCardLayout } from "@slide-first/core";
import { buildSlideCardHtml, buildSlideCardCss } from "./slide-card-template.js";

const s3Client = new S3Client({});

/** Hook overlay duration in ms */
const HOOK_DURATION_MS = 2000;
/** CTA duration in ms */
const CTA_DURATION_MS = 3000;

/** 16:9 dimensions */
const STANDARD_WIDTH = 1920;
const STANDARD_HEIGHT = 1080;

/** 9:16 dimensions */
const VERTICAL_WIDTH = 1080;
const VERTICAL_HEIGHT = 1920;

/**
 * Build the full Hyperframes HTML composition.
 */
export function buildTeaserHtml(
  slides: SelectedSlide[],
  hookText: string,
  ctaText: string,
  layout: "16x9" | "9x16",
  assetsPrefix: string,
): string {
  const is9x16 = layout === "9x16";
  const width = is9x16 ? VERTICAL_WIDTH : STANDARD_WIDTH;
  const height = is9x16 ? VERTICAL_HEIGHT : STANDARD_HEIGHT;
  const fps = 30;

  // Calculate timing for each slide
  let currentMs = 0;
  const timings: { slide: SelectedSlide; startMs: number; durationMs: number }[] = [];

  // Hook section
  const hookStartMs = currentMs;
  currentMs += HOOK_DURATION_MS;

  // Slides section
  for (const slide of slides) {
    timings.push({
      slide,
      startMs: currentMs,
      durationMs: slide.estimatedDurationMs,
    });
    currentMs += slide.estimatedDurationMs;
  }

  // CTA section
  const ctaStartMs = currentMs;
  currentMs += CTA_DURATION_MS;
  const totalDurationMs = currentMs;

  // Build slide HTML
  let slidesHtml: string;
  let additionalCss = "";

  if (is9x16) {
    const slideCardLayout = calculateSlideCardLayout(width, height);
    additionalCss = buildSlideCardCss(slideCardLayout);
    slidesHtml = timings
      .map((t) =>
        buildSlideCardHtml(t.slide, slideCardLayout, assetsPrefix, t.startMs, t.durationMs),
      )
      .join("\n");
  } else {
    slidesHtml = timings
      .map(
        (t) => `
    <div class="slide-frame" data-start="${t.startMs}" data-duration="${t.durationMs}">
      <img src="${assetsPrefix}${t.slide.imageKey}" style="width:100%; height:100%; object-fit:contain;" alt="Slide ${t.slide.slideNumber}" />
      <div class="subtitle-overlay">${escapeHtml(t.slide.teaserNote)}</div>
    </div>`,
      )
      .join("\n");
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=${width}, height=${height}" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: ${width}px; height: ${height}px; overflow: hidden; background: #000; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    #stage { position: relative; width: ${width}px; height: ${height}px; }
    .hook-overlay {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.85);
      z-index: 100;
    }
    .hook-text {
      font-size: ${is9x16 ? 64 : 72}px;
      font-weight: 800;
      color: #ffffff;
      text-align: center;
      padding: 40px;
      text-shadow: 0 2px 8px rgba(0,0,0,0.8);
    }
    .cta-overlay {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.9);
      z-index: 100;
    }
    .cta-text {
      font-size: ${is9x16 ? 48 : 56}px;
      font-weight: 700;
      color: #4a9eff;
      text-align: center;
      padding: 40px;
    }
    .slide-frame {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
    }
    .subtitle-overlay {
      position: absolute;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      max-width: 80%;
      font-size: ${is9x16 ? 28 : 32}px;
      font-weight: 600;
      color: #ffffff;
      text-align: center;
      padding: 12px 24px;
      background: rgba(0,0,0,0.7);
      border-radius: 8px;
      line-height: 1.4;
    }
    ${additionalCss}
  </style>
</head>
<body>
  <div id="stage"
    data-composition-width="${width}"
    data-composition-height="${height}"
    data-composition-fps="${fps}"
    data-composition-duration="${totalDurationMs}">

    <!-- Hook overlay -->
    <div class="hook-overlay" data-start="${hookStartMs}" data-duration="${HOOK_DURATION_MS}">
      <span class="hook-text">${escapeHtml(hookText)}</span>
    </div>

    <!-- Slides -->
    ${slidesHtml}

    <!-- CTA overlay -->
    <div class="cta-overlay" data-start="${ctaStartMs}" data-duration="${CTA_DURATION_MS}">
      <span class="cta-text">${escapeHtml(ctaText || "Follow for more")}</span>
    </div>

  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Lambda handler for teaser composition building.
 */
export const handler = async (
  event: TeaserCompositionBuilderEvent,
): Promise<TeaserCompositionBuilderResult> => {
  const {
    s3Bucket,
    s3Prefix,
    assetsPrefix,
    selectedSlides,
    hookText,
    ctaText,
    layout,
  } = event;

  // Build the HTML composition
  const html = buildTeaserHtml(
    selectedSlides,
    hookText,
    ctaText ?? "Follow for more",
    layout,
    assetsPrefix,
  );

  // Upload to S3
  const compositionKey = `${s3Prefix}teaser/${layout}/index.html`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: compositionKey,
      Body: html,
      ContentType: "text/html; charset=utf-8",
    }),
  );

  // Calculate total duration
  const slidesDurationMs = selectedSlides.reduce(
    (sum, s) => sum + s.estimatedDurationMs,
    0,
  );
  const totalDurationMs = HOOK_DURATION_MS + slidesDurationMs + CTA_DURATION_MS;

  return {
    compositionKey,
    totalSlides: selectedSlides.length,
    totalDurationMs,
    layout,
  };
};
