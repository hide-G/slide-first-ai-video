import type { Manifest } from "./manifest.js";

/**
 * Invariant validation errors with descriptions.
 */
export interface InvariantViolation {
  rule: string;
  message: string;
}

/**
 * Validates the structural invariants:
 *
 * 1. pages.length === source.pageCount
 * 2. All script.text must be non-empty before audio stage starts
 *    (if stages.audio is "running" or "done")
 * 3. audioDurationSec must be positive for all pages when audio stage is "done"
 * 4. frameAlignedDurationMs >= audioDurationSec * 1000 for each page
 * 5. Frame excess (frameAlignedDurationMs - audioDurationSec*1000) <= 34ms per page
 * 6. pageNumber must be sequential starting from 1
 */
export function validateInvariants(manifest: Manifest): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  // Rule 1: pages.length === source.pageCount
  if (manifest.pages.length !== manifest.source.pageCount) {
    violations.push({
      rule: "pages-count",
      message: `pages.length (${manifest.pages.length}) must equal source.pageCount (${manifest.source.pageCount})`,
    });
  }

  // Rule 2: All script.text non-empty before audio stage starts
  const audioActive =
    manifest.stages.audio === "running" || manifest.stages.audio === "done";
  if (audioActive) {
    for (const page of manifest.pages) {
      if (!page.script.text || page.script.text.trim().length === 0) {
        violations.push({
          rule: "script-non-empty",
          message: `Page ${page.pageNumber} has empty script.text but audio stage is "${manifest.stages.audio}"`,
        });
      }
    }
  }

  // Rule 3: audioDurationSec must be positive when audio is done
  if (manifest.stages.audio === "done") {
    for (const page of manifest.pages) {
      if (page.audioDurationSec <= 0) {
        violations.push({
          rule: "audio-duration-positive",
          message: `Page ${page.pageNumber} has audioDurationSec=${page.audioDurationSec} but audio stage is "done"`,
        });
      }
    }
  }

  // Rule 4 & 5: frameAlignedDurationMs constraints when audio is done
  if (manifest.stages.audio === "done") {
    for (const page of manifest.pages) {
      if (page.frameAlignedDurationMs > 0 && page.audioDurationSec > 0) {
        const audioMs = page.audioDurationSec * 1000;
        // Must be >= audio duration in ms
        if (page.frameAlignedDurationMs < audioMs) {
          violations.push({
            rule: "frame-aligned-gte-audio",
            message: `Page ${page.pageNumber}: frameAlignedDurationMs (${page.frameAlignedDurationMs}) must be >= audioDurationSec*1000 (${audioMs})`,
          });
        }
        // Excess must be <= FRAME_EXCESS_MS
        const excess = page.frameAlignedDurationMs - audioMs;
        if (excess > TOLERANCES.FRAME_EXCESS_MS) {
          violations.push({
            rule: "frame-excess",
            message: `Page ${page.pageNumber}: frame excess ${excess.toFixed(3)}ms exceeds maximum ${TOLERANCES.FRAME_EXCESS_MS}ms`,
          });
        }
      }
    }
  }

  // Rule 6: pageNumber must be sequential starting from 1
  for (let i = 0; i < manifest.pages.length; i++) {
    if (manifest.pages[i].pageNumber !== i + 1) {
      violations.push({
        rule: "page-number-sequential",
        message: `Page at index ${i} has pageNumber=${manifest.pages[i].pageNumber}, expected ${i + 1}`,
      });
    }
  }

  return violations;
}

/**
 * Tolerance constants for the MediaConvert pipeline.
 */
export const TOLERANCES = {
  /** Maximum total duration drift in milliseconds */
  TOTAL_DURATION_MS: 50,
  /** Maximum frame-aligned excess per page in milliseconds (one frame at 30fps = 33.33ms) */
  FRAME_EXCESS_MS: 34,
} as const;
