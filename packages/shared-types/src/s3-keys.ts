/**
 * S3 key builder functions matching the layout defined in section 4.1.
 *
 * All paths are relative to the bucket root:
 *   users/{userId}/projects/{projectId}/...
 */

export interface S3KeyParams {
  userId: string;
  projectId: string;
}

function prefix(params: S3KeyParams): string {
  return `users/${params.userId}/projects/${params.projectId}`;
}

/** Zero-padded page number: "001", "002", ... */
function padPage(pageNumber: number): string {
  return String(pageNumber).padStart(3, "0");
}

// --- Input ---

export function inputSourceKey(
  params: S3KeyParams,
  ext: "pdf" | "pptx"
): string {
  return `${prefix(params)}/input/source.${ext}`;
}

// --- Deck ---

export function deckKey(
  params: S3KeyParams,
  ext: "md" | "pdf" | "pptx"
): string {
  return `${prefix(params)}/deck/deck.${ext}`;
}

// --- Pages ---

export function pageImageKey(params: S3KeyParams, pageNumber: number): string {
  return `${prefix(params)}/pages/page-${padPage(pageNumber)}.png`;
}

// --- Audio ---

export function audioKey(params: S3KeyParams, pageNumber: number): string {
  return `${prefix(params)}/audio/page-${padPage(pageNumber)}.wav`;
}

// --- Captions ---

export function captionsSrtKey(params: S3KeyParams): string {
  return `${prefix(params)}/captions/captions.srt`;
}

// --- Output ---

export function outputVideoKey(
  params: S3KeyParams,
  renderId: string
): string {
  return `${prefix(params)}/output/${renderId}/video.mp4`;
}

// --- Manifest ---

export function manifestKey(params: S3KeyParams): string {
  return `${prefix(params)}/manifest.json`;
}

// --- Project prefix (for listing) ---

export function projectPrefix(params: S3KeyParams): string {
  return `${prefix(params)}/`;
}
