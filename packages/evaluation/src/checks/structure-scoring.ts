import { StructureScoringResult } from "../types.js";

/**
 * Keywords that indicate a problem statement in slide content.
 */
const PROBLEM_KEYWORDS = [
  "problem",
  "challenge",
  "issue",
  "pain point",
  "difficulty",
  "limitation",
  "bottleneck",
  "why",
  "motivation",
  "current state",
  "before",
];

/**
 * Keywords that indicate a solution in slide content.
 */
const SOLUTION_KEYWORDS = [
  "solution",
  "approach",
  "how we",
  "implementation",
  "proposal",
  "answer",
  "resolution",
  "introducing",
  "our approach",
  "what we built",
];

/**
 * Keywords that indicate supporting evidence.
 */
const EVIDENCE_KEYWORDS = [
  "result",
  "metric",
  "benchmark",
  "data",
  "performance",
  "improvement",
  "comparison",
  "before and after",
  "measurement",
  "demo",
  "example",
  "proof",
  "evidence",
];

/**
 * Keywords that indicate a summary/conclusion.
 */
const SUMMARY_KEYWORDS = [
  "summary",
  "conclusion",
  "takeaway",
  "key points",
  "recap",
  "next steps",
  "wrap up",
  "closing",
  "in closing",
  "what we learned",
  "thank",
];

/**
 * Check if any keyword is found in the content (case-insensitive).
 */
function hasKeywordMatch(content: string, keywords: string[]): boolean {
  const lower = content.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * Score the structure of a slide deck based on the presence of
 * problem/solution/evidence/summary sections.
 *
 * Scoring:
 * - 1 point for each structural element present (problem, solution, evidence, summary)
 * - +1 bonus point if all four are present (indicating a well-structured narrative)
 *
 * Returns a score from 1 to 5.
 */
export function checkStructureScoring(markdown: string): StructureScoringResult {
  // Split into individual slides (Marp uses --- as separator)
  const slides = markdown.split(/^---$/m).map((s) => s.trim());
  const fullContent = slides.join("\n");

  // Also check slide titles (lines starting with # after slide separator)
  const titles = slides
    .map((slide) => {
      const titleMatch = slide.match(/^#{1,3}\s+(.+)$/m);
      return titleMatch ? titleMatch[1] : "";
    })
    .join("\n");

  const searchContent = fullContent + "\n" + titles;

  const hasProblem = hasKeywordMatch(searchContent, PROBLEM_KEYWORDS);
  const hasSolution = hasKeywordMatch(searchContent, SOLUTION_KEYWORDS);
  const hasEvidence = hasKeywordMatch(searchContent, EVIDENCE_KEYWORDS);
  const hasSummary = hasKeywordMatch(searchContent, SUMMARY_KEYWORDS);

  let score = 0;
  if (hasProblem) score++;
  if (hasSolution) score++;
  if (hasEvidence) score++;
  if (hasSummary) score++;

  // Bonus for having all four elements (complete narrative structure)
  if (hasProblem && hasSolution && hasEvidence && hasSummary) {
    score++;
  }

  // Ensure minimum score of 1
  score = Math.max(1, score);

  return {
    score,
    details: {
      hasProblem,
      hasSolution,
      hasEvidence,
      hasSummary,
    },
  };
}
