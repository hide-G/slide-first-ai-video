/**
 * Slide-card layout calculation for 9:16 vertical format.
 * Top 60% shows the 16:9 slide scaled to fit the width.
 * Bottom 40% holds keyPoints and large caption text.
 */

import type { SlideCardLayout } from "@slide-first/shared-types";

/** Standard 9:16 slide-card dimensions (1080x1920) */
export const SLIDE_CARD_DIMENSIONS = {
  width: 1080,
  height: 1920,
  slideAreaRatio: 0.6,
  captionAreaRatio: 0.4,
  /** 16:9 aspect ratio for the slide image */
  slideAspectRatio: 16 / 9,
  /** Padding inside the caption area */
  captionPadding: 40,
} as const;

/**
 * Calculate the slide-card layout for 9:16 format.
 * The 16:9 slide is scaled to fit the full width of the card,
 * centered vertically within the top 60% area.
 */
export function calculateSlideCardLayout(
  width: number = SLIDE_CARD_DIMENSIONS.width,
  height: number = SLIDE_CARD_DIMENSIONS.height,
): SlideCardLayout {
  const slideAreaHeight = Math.round(height * SLIDE_CARD_DIMENSIONS.slideAreaRatio);
  const captionAreaHeight = height - slideAreaHeight;

  // Scale the 16:9 slide to fit the full width
  const slideImageWidth = width;
  const slideImageHeight = Math.round(width / SLIDE_CARD_DIMENSIONS.slideAspectRatio);

  // Center the slide image vertically in the top area
  const slideTop = Math.round((slideAreaHeight - slideImageHeight) / 2);

  return {
    width,
    height,
    slideArea: {
      top: Math.max(0, slideTop),
      left: 0,
      width: slideImageWidth,
      height: slideImageHeight,
    },
    captionArea: {
      top: slideAreaHeight,
      left: SLIDE_CARD_DIMENSIONS.captionPadding,
      width: width - SLIDE_CARD_DIMENSIONS.captionPadding * 2,
      height: captionAreaHeight - SLIDE_CARD_DIMENSIONS.captionPadding,
    },
  };
}
