/**
 * S3 key builder functions for packages/core.
 *
 * These re-export and extend the canonical key builders from @slide-first/shared-types.
 * The canonical layout (section 4.1):
 *
 *   users/{userId}/projects/{projectId}/
 *     input/source.pdf | input/source.pptx
 *     deck/deck.md, deck/deck.pdf, deck/deck.pptx
 *     pages/page-001.png, page-002.png, ...
 *     audio/page-001.mp3, page-002.mp3, ...
 *     captions/captions.srt
 *     clips/page-001.mp4, page-002.mp4, ...
 *     output/{renderId}/video.mp4
 *     manifest.json
 */

import {
  inputSourceKey,
  deckKey,
  pageImageKey,
  audioKey,
  captionsSrtKey,
  clipKey,
  outputVideoKey,
  manifestKey,
  projectPrefix,
} from "@slide-first/shared-types";

import type { S3KeyParams } from "@slide-first/shared-types";

export type { S3KeyParams };

// Re-export all canonical key builders
export {
  inputSourceKey,
  deckKey,
  pageImageKey,
  audioKey,
  captionsSrtKey,
  clipKey,
  outputVideoKey,
  manifestKey,
  projectPrefix,
};

/**
 * Build all page-related keys for a given page number.
 * Useful when processing a single page through the pipeline.
 */
export function pageKeys(
  params: S3KeyParams,
  pageNumber: number,
): { image: string; audio: string; clip: string } {
  return {
    image: pageImageKey(params, pageNumber),
    audio: audioKey(params, pageNumber),
    clip: clipKey(params, pageNumber),
  };
}

/**
 * Build all keys for a complete project render.
 */
export function renderKeys(
  params: S3KeyParams,
  renderId: string,
  pageCount: number,
): {
  manifest: string;
  captionsSrt: string;
  outputVideo: string;
  pages: { image: string; audio: string; clip: string }[];
} {
  const pages = Array.from({ length: pageCount }, (_, i) =>
    pageKeys(params, i + 1),
  );

  return {
    manifest: manifestKey(params),
    captionsSrt: captionsSrtKey(params),
    outputVideo: outputVideoKey(params, renderId),
    pages,
  };
}

/**
 * Legacy compatibility: build a version prefix for the API layer.
 * In the new architecture, versions are tracked via manifest, but
 * the API still uses a version-based prefix for backward compatibility.
 */
export function buildVersionPrefix(params: {
  userId: string;
  projectId: string;
  versionNumber: number;
}): string {
  return `users/${params.userId}/projects/${params.projectId}/v${params.versionNumber}/`;
}
