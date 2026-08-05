import {
  GoldenSetFixture,
  EvaluationReport,
  EvaluationThresholds,
  DEFAULT_THRESHOLDS,
  CheckResult,
} from "./types.js";
import { checkStructureScoring } from "./checks/structure-scoring.js";
import { checkNoteCompleteness } from "./checks/note-completeness.js";
import { checkCharacterLimits } from "./checks/character-limits.js";
import { checkProhibitedExpressions } from "./checks/prohibited-expressions.js";

export interface RunnerOptions {
  thresholds?: EvaluationThresholds;
  skipUrlCheck?: boolean;
}

/**
 * Run all evaluation checks against a generated markdown deck
 * using the given fixture definition.
 *
 * URL reachability is skipped by default since it requires network access.
 */
export function runEvaluation(
  markdown: string,
  fixture: GoldenSetFixture,
  options: RunnerOptions = {},
): EvaluationReport {
  const thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;
  const checks: CheckResult[] = [];

  // Check 1: Structure scoring
  const structureResult = checkStructureScoring(markdown);
  checks.push({
    name: "structure-scoring",
    passed: structureResult.score >= thresholds.structureScoreMin,
    details: structureResult,
  });

  // Check 2: Note completeness
  const noteResult = checkNoteCompleteness(markdown);
  const noteRatio =
    noteResult.totalSlides > 0
      ? noteResult.slidesWithNotes / noteResult.totalSlides
      : 0;
  const keyPointsRatio =
    noteResult.totalSlides > 0
      ? noteResult.slidesWithKeyPoints / noteResult.totalSlides
      : 0;
  checks.push({
    name: "note-completeness",
    passed:
      noteRatio >= thresholds.noteCompletenessMin &&
      keyPointsRatio >= thresholds.noteCompletenessMin &&
      noteResult.oversizedNotes.length === 0,
    details: noteResult,
  });

  // Check 3: Character limits
  const charResult = checkCharacterLimits(markdown);
  checks.push({
    name: "character-limits",
    passed:
      charResult.violations.length <= thresholds.maxCharacterViolations,
    details: charResult,
  });

  // Check 4: Prohibited expressions
  const prohibitedResult = checkProhibitedExpressions(
    markdown,
    fixture.prohibitedExpressions,
  );
  checks.push({
    name: "prohibited-expressions",
    passed:
      prohibitedResult.matches.length <= thresholds.maxProhibitedExpressions,
    details: prohibitedResult,
  });

  // Overall verdict: all checks must pass
  const overallPass = checks.every((c) => c.passed);

  return {
    fixtureId: fixture.id,
    theme: fixture.theme,
    checks,
    overallPass,
  };
}
