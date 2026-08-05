import { describe, it, expect } from "vitest";
import { checkCharacterLimits } from "../checks/character-limits.js";

describe("checkCharacterLimits", () => {
  it("should pass for a slide within all limits", () => {
    const md = `
# Short Title

- Bullet point 1
- Bullet point 2
- Bullet point 3
`;
    const result = checkCharacterLimits(md);
    expect(result.violations).toHaveLength(0);
  });

  it("should detect title that exceeds max length", () => {
    const longTitle = "A".repeat(81);
    const md = `
# ${longTitle}

Content here.
`;
    const result = checkCharacterLimits(md);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].violation).toBe("title_too_long");
    expect(result.violations[0].actual).toBe(81);
    expect(result.violations[0].limit).toBe(80);
  });

  it("should detect body with too many lines", () => {
    const lines = Array.from({ length: 15 }, (_, i) => `- Line ${i + 1}`).join(
      "\n",
    );
    const md = `
# Normal Title

${lines}
`;
    const result = checkCharacterLimits(md);
    const bodyViolation = result.violations.find(
      (v) => v.violation === "body_too_many_lines",
    );
    expect(bodyViolation).toBeDefined();
    expect(bodyViolation!.actual).toBeGreaterThan(12);
  });

  it("should detect body lines that are too long", () => {
    const longLine = "X".repeat(121);
    const md = `
# Title

${longLine}
`;
    const result = checkCharacterLimits(md);
    const lineViolation = result.violations.find(
      (v) => v.violation === "body_line_too_long",
    );
    expect(lineViolation).toBeDefined();
    expect(lineViolation!.actual).toBe(121);
  });

  it("should detect code blocks that are too long", () => {
    const codeLines = Array.from(
      { length: 25 },
      (_, i) => `const x${i} = ${i};`,
    ).join("\n");
    const md = `
# Code Example

\`\`\`typescript
${codeLines}
\`\`\`
`;
    const result = checkCharacterLimits(md);
    const codeViolation = result.violations.find(
      (v) => v.violation === "code_block_too_long",
    );
    expect(codeViolation).toBeDefined();
    expect(codeViolation!.actual).toBe(25);
    expect(codeViolation!.limit).toBe(20);
  });

  it("should handle multiple slides with mixed violations", () => {
    const longTitle = "B".repeat(100);
    const md = `
# ${longTitle}

Short body.

---

# Normal Title

Normal content.
`;
    const result = checkCharacterLimits(md);
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.violations[0].violation).toBe("title_too_long");
  });

  it("should accept custom character limit configuration", () => {
    const md = `
# Title That Is Slightly Long

Content here.
`;
    const strictConfig = {
      titleMaxLength: 10,
      bodyMaxLines: 5,
      bodyMaxCharsPerLine: 50,
      codeBlockMaxLines: 10,
    };
    const result = checkCharacterLimits(md, strictConfig);
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.violations[0].violation).toBe("title_too_long");
  });

  it("should not count empty lines in body", () => {
    const md = `
# Title

Line 1

Line 2

Line 3
`;
    const result = checkCharacterLimits(md);
    expect(
      result.violations.filter((v) => v.violation === "body_too_many_lines"),
    ).toHaveLength(0);
  });
});
