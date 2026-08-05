import { describe, it, expect } from "vitest";
import { checkProhibitedExpressions } from "../checks/prohibited-expressions.js";

describe("checkProhibitedExpressions", () => {
  it("should pass for clean content", () => {
    const md = `
# Technical Overview

This approach provides measurable improvements in latency.

---

# Implementation

The system uses event-driven architecture for scalability.
`;
    const prohibited = ["revolutionary", "game-changing", "silver bullet"];
    const result = checkProhibitedExpressions(md, prohibited);
    expect(result.matches).toHaveLength(0);
  });

  it("should detect prohibited expressions", () => {
    const md = `
# Amazing Feature

This is a revolutionary approach that is absolutely game-changing.
`;
    const prohibited = ["revolutionary", "game-changing"];
    const result = checkProhibitedExpressions(md, prohibited);
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0].expression).toBe("revolutionary");
    expect(result.matches[1].expression).toBe("game-changing");
  });

  it("should be case-insensitive", () => {
    const md = `
# Feature

This is REVOLUTIONARY technology.
`;
    const prohibited = ["revolutionary"];
    const result = checkProhibitedExpressions(md, prohibited);
    expect(result.matches).toHaveLength(1);
  });

  it("should report slide index for each match", () => {
    const md = `
# Slide 1

Clean content here.

---

# Slide 2

This is a silver bullet solution.
`;
    const prohibited = ["silver bullet"];
    const result = checkProhibitedExpressions(md, prohibited);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].slideIndex).toBe(1);
  });

  it("should include context around the match", () => {
    const md = `
# Feature

Consider that this revolutionary approach works well.
`;
    const prohibited = ["revolutionary"];
    const result = checkProhibitedExpressions(md, prohibited);
    expect(result.matches[0].context).toContain("revolutionary");
  });

  it("should handle empty prohibited list", () => {
    const md = `
# Whatever

Any content is fine.
`;
    const result = checkProhibitedExpressions(md, []);
    expect(result.matches).toHaveLength(0);
  });

  it("should detect multiple matches in same slide", () => {
    const md = `
# Slide

This is absolutely the best and most revolutionary approach ever.
`;
    const prohibited = ["absolutely the best", "revolutionary"];
    const result = checkProhibitedExpressions(md, prohibited);
    expect(result.matches).toHaveLength(2);
  });
});
