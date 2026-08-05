import {
  CharacterLimitsResult,
  CharacterLimitViolation,
  CharacterLimitConfig,
  DEFAULT_CHARACTER_LIMITS,
} from "../types.js";

/**
 * Check per-slide character and line constraints.
 *
 * Validates:
 * - Title length does not exceed maximum
 * - Body text does not exceed maximum line count
 * - Individual body lines do not exceed character limit
 * - Code blocks do not exceed maximum line count
 */
export function checkCharacterLimits(
  markdown: string,
  config: CharacterLimitConfig = DEFAULT_CHARACTER_LIMITS,
): CharacterLimitsResult {
  const slideContents = markdown.split(/^---$/m).map((s) => s.trim());
  const violations: CharacterLimitViolation[] = [];

  for (let i = 0; i < slideContents.length; i++) {
    const content = slideContents[i];
    if (content.length === 0) continue;

    // Extract title
    const titleMatch = content.match(/^#{1,3}\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : `Slide ${i + 1}`;

    // Check title length
    if (title.length > config.titleMaxLength) {
      violations.push({
        slideIndex: i,
        slideTitle: title,
        violation: "title_too_long",
        actual: title.length,
        limit: config.titleMaxLength,
      });
    }

    // Get body content (remove title, comments, and code blocks for line counting)
    const bodyContent = content
      .replace(/^#{1,3}\s+.+$/m, "") // Remove title
      .replace(/<!--[\s\S]*?-->/g, "") // Remove comments
      .replace(/```[\s\S]*?```/g, "") // Remove code blocks
      .trim();

    const bodyLines = bodyContent
      .split("\n")
      .filter((line) => line.trim().length > 0);

    // Check body line count
    if (bodyLines.length > config.bodyMaxLines) {
      violations.push({
        slideIndex: i,
        slideTitle: title,
        violation: "body_too_many_lines",
        actual: bodyLines.length,
        limit: config.bodyMaxLines,
      });
    }

    // Check individual body line length
    for (const line of bodyLines) {
      if (line.length > config.bodyMaxCharsPerLine) {
        violations.push({
          slideIndex: i,
          slideTitle: title,
          violation: "body_line_too_long",
          actual: line.length,
          limit: config.bodyMaxCharsPerLine,
        });
        break; // Only report once per slide
      }
    }

    // Check code blocks
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
    for (const block of codeBlocks) {
      const codeLines = block.split("\n");
      // Subtract opening and closing ``` lines
      const codeLineCount = codeLines.length - 2;
      if (codeLineCount > config.codeBlockMaxLines) {
        violations.push({
          slideIndex: i,
          slideTitle: title,
          violation: "code_block_too_long",
          actual: codeLineCount,
          limit: config.codeBlockMaxLines,
        });
      }
    }
  }

  return { violations };
}
