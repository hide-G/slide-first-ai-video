/**
 * HTML template for 9:16 slide-card format.
 * Top portion shows the 16:9 slide image scaled to fit width.
 * Bottom portion shows keyPoints as bullets and large caption text.
 */

import type { SelectedSlide, SlideCardLayout } from "@slide-first/shared-types";

/**
 * Build HTML for a single slide in 9:16 slide-card format.
 */
export function buildSlideCardHtml(
  slide: SelectedSlide,
  layout: SlideCardLayout,
  assetsPrefix: string,
  startMs: number,
  durationMs: number,
): string {
  const { slideArea, captionArea } = layout;

  const keyPointsHtml = slide.keyPoints
    .map((point) => `<li class="key-point">${escapeHtml(point)}</li>`)
    .join("\n          ");

  return `
    <div class="slide-card" data-start="${startMs}" data-duration="${durationMs}">
      <div class="slide-image-area" style="position:absolute; top:${slideArea.top}px; left:${slideArea.left}px; width:${slideArea.width}px; height:${slideArea.height}px;">
        <img src="${assetsPrefix}${slide.imageKey}" style="width:100%; height:100%; object-fit:contain;" alt="Slide ${slide.slideNumber}" />
      </div>
      <div class="caption-area" style="position:absolute; top:${captionArea.top}px; left:${captionArea.left}px; width:${captionArea.width}px; height:${captionArea.height}px;">
        <ul class="key-points-list">
          ${keyPointsHtml}
        </ul>
        <p class="teaser-caption">${escapeHtml(slide.teaserNote)}</p>
      </div>
    </div>`;
}

/**
 * Build CSS for the 9:16 slide-card layout.
 */
export function buildSlideCardCss(layout: SlideCardLayout): string {
  return `
    .slide-card {
      position: absolute;
      width: ${layout.width}px;
      height: ${layout.height}px;
      background: #0a0a0a;
      overflow: hidden;
    }
    .slide-image-area {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #111;
    }
    .caption-area {
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 20px;
      background: #0a0a0a;
      color: #ffffff;
    }
    .key-points-list {
      list-style: none;
      padding: 0;
      margin: 0 0 20px 0;
    }
    .key-point {
      font-size: 28px;
      font-weight: 500;
      line-height: 1.5;
      margin-bottom: 12px;
      color: #e0e0e0;
      padding-left: 20px;
      border-left: 3px solid #4a9eff;
    }
    .teaser-caption {
      font-size: 36px;
      font-weight: 700;
      line-height: 1.3;
      color: #ffffff;
      text-align: center;
      margin: 0;
    }`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
