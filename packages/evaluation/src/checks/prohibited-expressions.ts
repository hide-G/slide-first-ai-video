import { ProhibitedExpressionsResult, ProhibitedExpressionMatch } from "../types.js";

/**
 * Default prohibited expressions that indicate exaggerated claims,
 * unqualified absolutes, or marketing language without evidence.
 */
export const DEFAULT_PROHIBITED_EXPRESSIONS: string[] = [
  "revolutionary",
  "game-changing",
  "silver bullet",
  "absolutely the best",
  "everyone knows",
  "obviously",
  "no brainer",
  "guaranteed",
  "unprecedented",
  "world-class",
  "industry-leading",
  "magical",
  "clearly superior",
  "always better",
  "never use",
  "perfect solution",
  "trivial",
  "any fool can",
  "infinitely scalable",
  "zero downtime guaranteed",
  "eliminates all",
  "flawless",
  "painless",
  "zero risk",
  "effortless",
  "instant results",
  "kills all competitors",
  "only tool you need",
  "replaces everything",
  "absolutely perfect",
  "always faster",
  "eliminates all latency",
  "infinite performance",
  "guaranteed 100x",
];

/**
 * Check markdown content for prohibited expressions.
 *
 * Searches for exaggerated claims, unqualified absolutes, and
 * marketing language without evidence.
 */
export function checkProhibitedExpressions(
  markdown: string,
  prohibitedExpressions: string[] = DEFAULT_PROHIBITED_EXPRESSIONS,
): ProhibitedExpressionsResult {
  const slideContents = markdown.split(/^---$/m).map((s) => s.trim());
  const matches: ProhibitedExpressionMatch[] = [];

  for (let i = 0; i < slideContents.length; i++) {
    const content = slideContents[i];
    if (content.length === 0) continue;

    const lowerContent = content.toLowerCase();

    for (const expression of prohibitedExpressions) {
      const lowerExpr = expression.toLowerCase();
      const exprIndex = lowerContent.indexOf(lowerExpr);

      if (exprIndex !== -1) {
        // Extract surrounding context (up to 50 chars on each side)
        const start = Math.max(0, exprIndex - 50);
        const end = Math.min(content.length, exprIndex + lowerExpr.length + 50);
        const context = content.slice(start, end).replace(/\n/g, " ");

        matches.push({
          slideIndex: i,
          expression,
          context: `...${context}...`,
        });
      }
    }
  }

  return { matches };
}
