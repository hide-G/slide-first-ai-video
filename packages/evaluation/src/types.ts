/**
 * Golden set fixture definition for a representative LT theme.
 */
export interface GoldenSetFixture {
  id: string;
  theme: string;
  audience: string;
  duration: number;
  urls: string[];
  expectedStructure: {
    problem: boolean;
    solution: boolean;
    evidence: boolean;
    summary: boolean;
  };
  prohibitedExpressions: string[];
  expectedSlideCountRange: [number, number];
}

/**
 * Result from URL reachability check.
 */
export interface UrlReachabilityResult {
  totalUrls: number;
  reachableCount: number;
  unreachableUrls: string[];
}

/**
 * Result from structure scoring check.
 */
export interface StructureScoringResult {
  score: number;
  details: {
    hasProblem: boolean;
    hasSolution: boolean;
    hasEvidence: boolean;
    hasSummary: boolean;
  };
}

/**
 * Result from note completeness check.
 */
export interface NoteCompletenessResult {
  totalSlides: number;
  slidesWithNotes: number;
  slidesWithKeyPoints: number;
  oversizedNotes: string[];
}

/**
 * Character limit violation.
 */
export interface CharacterLimitViolation {
  slideIndex: number;
  slideTitle: string;
  violation: string;
  actual: number;
  limit: number;
}

/**
 * Result from character limits check.
 */
export interface CharacterLimitsResult {
  violations: CharacterLimitViolation[];
}

/**
 * Prohibited expression match.
 */
export interface ProhibitedExpressionMatch {
  slideIndex: number;
  expression: string;
  context: string;
}

/**
 * Result from prohibited expressions check.
 */
export interface ProhibitedExpressionsResult {
  matches: ProhibitedExpressionMatch[];
}

/**
 * Individual check result in evaluation report.
 */
export interface CheckResult {
  name: string;
  passed: boolean;
  details: unknown;
}

/**
 * Full evaluation report for a single fixture.
 */
export interface EvaluationReport {
  fixtureId: string;
  theme: string;
  checks: CheckResult[];
  overallPass: boolean;
}

/**
 * Thresholds for evaluation checks.
 */
export interface EvaluationThresholds {
  structureScoreMin: number;
  noteCompletenessMin: number;
  maxCharacterViolations: number;
  maxProhibitedExpressions: number;
}

export const DEFAULT_THRESHOLDS: EvaluationThresholds = {
  structureScoreMin: 4,
  noteCompletenessMin: 1.0,
  maxCharacterViolations: 0,
  maxProhibitedExpressions: 0,
};

/**
 * Character limit configuration.
 */
export interface CharacterLimitConfig {
  titleMaxLength: number;
  bodyMaxLines: number;
  bodyMaxCharsPerLine: number;
  codeBlockMaxLines: number;
}

export const DEFAULT_CHARACTER_LIMITS: CharacterLimitConfig = {
  titleMaxLength: 80,
  bodyMaxLines: 12,
  bodyMaxCharsPerLine: 120,
  codeBlockMaxLines: 20,
};
