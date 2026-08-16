import type { Manifest } from "./manifest.js";

/**
 * Invariant validation errors with descriptions.
 */
export interface InvariantViolation {
  rule: string;
  message: string;
}

/**
 * Validates the structural invariants defined in section 4.3:
 *
 * 1. pages.length === source.pageCount
 * 2. All script.text must be non-empty before audio stage starts
 *    (if stages.audio is "running" or "done")
 * 3. audioDurationSec must be positive for all pages when audio stage is "done"
 * 4. Each page video duration matches audioDurationSec (checked at runtime via ffprobe)
 * 5. Total video duration matches sum of audioDurationSec (checked at runtime)
 * 6. Subtitle timecodes from cumulative audioDurationSec (checked at runtime)
 *
 * Rules 4, 5, 6 require runtime ffprobe measurement and cannot be
 * validated purely from manifest data. They are documented here but
 * enforced by the pipeline stages.
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

  // Rule 3 (derived): audioDurationSec must be positive when audio is done
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

  // Rule: pageNumber must be sequential starting from 1
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
 * Tolerance constants from section 4.3.
 */
export const TOLERANCES = {
  /** Maximum difference between page video duration and audioDurationSec (seconds) */
  PAGE_DURATION_SEC: 0.05,
  /** Maximum difference between total video duration and sum of audioDurationSec (seconds) */
  TOTAL_DURATION_SEC: 0.2,
} as const;
