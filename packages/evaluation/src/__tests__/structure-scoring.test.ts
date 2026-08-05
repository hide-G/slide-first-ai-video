import { describe, it, expect } from "vitest";
import { checkStructureScoring } from "../checks/structure-scoring.js";

describe("checkStructureScoring", () => {
  it("should give score 5 to a well-structured deck with all elements", () => {
    const md = `
# The Problem

We face significant challenges with cold starts in our system.

---

# Our Solution

We propose using provisioned concurrency to address this issue.

---

# Evidence and Results

Benchmark data shows 10x improvement in latency.

---

# Summary and Takeaways

In conclusion, this approach effectively solves the cold start problem.
`;
    const result = checkStructureScoring(md);
    expect(result.score).toBe(5);
    expect(result.details.hasProblem).toBe(true);
    expect(result.details.hasSolution).toBe(true);
    expect(result.details.hasEvidence).toBe(true);
    expect(result.details.hasSummary).toBe(true);
  });

  it("should give score less than 4 to a poorly structured deck", () => {
    const md = `
# Topic 1

Some random content here.

---

# Topic 2

More random content without clear structure.

---

# Topic 3

Additional content that does not follow problem/solution pattern.
`;
    const result = checkStructureScoring(md);
    expect(result.score).toBeLessThan(4);
  });

  it("should detect problem keywords in content", () => {
    const md = `
# Current Challenges

The main difficulty we face is performance bottleneck in the pipeline.

---

# Random slide

More info here.
`;
    const result = checkStructureScoring(md);
    expect(result.details.hasProblem).toBe(true);
  });

  it("should detect solution keywords in content", () => {
    const md = `
# Our Approach

Here is our implementation plan.

---

# Details

Technical details.
`;
    const result = checkStructureScoring(md);
    expect(result.details.hasSolution).toBe(true);
  });

  it("should detect evidence keywords in content", () => {
    const md = `
# Benchmark Results

Performance metrics show 5x improvement in comparison tests.
`;
    const result = checkStructureScoring(md);
    expect(result.details.hasEvidence).toBe(true);
  });

  it("should detect summary keywords in content", () => {
    const md = `
# Key Takeaways

Recap of what we learned in this presentation.
`;
    const result = checkStructureScoring(md);
    expect(result.details.hasSummary).toBe(true);
  });

  it("should give minimum score of 1 even with no matches", () => {
    const md = `
# Slide

Generic content.
`;
    const result = checkStructureScoring(md);
    expect(result.score).toBeGreaterThanOrEqual(1);
  });

  it("should score 4 when missing one element", () => {
    const md = `
# The Problem

Scaling challenges impact user experience.

---

# Our Approach

Our implementation solves this issue.

---

# Key Takeaways

Recap of what we discussed.
`;
    // Has problem, solution, summary but no evidence keywords
    const result = checkStructureScoring(md);
    // 3 elements found = 3 points (no bonus since not all 4)
    expect(result.score).toBe(3);
    expect(result.details.hasEvidence).toBe(false);
  });
});
