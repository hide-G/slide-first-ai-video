import { describe, it, expect } from "vitest";
import { runEvaluation } from "../runner.js";
import { GoldenSetFixture, EvaluationThresholds } from "../types.js";

const goodFixture: GoldenSetFixture = {
  id: "test-001",
  theme: "technical-explanation",
  audience: "engineers",
  duration: 5,
  urls: ["https://example.com"],
  expectedStructure: {
    problem: true,
    solution: true,
    evidence: true,
    summary: true,
  },
  prohibitedExpressions: ["revolutionary", "game-changing"],
  expectedSlideCountRange: [3, 8],
};

const wellStructuredDeck = `
# The Problem

Cold starts are a challenge in serverless architectures.

<!-- presenterNote: Cold starts add latency to user requests, particularly for Java and .NET runtimes. -->
<!-- keyPoints: ["Cold starts add latency", "Affects Java/.NET most"] -->

---

# Our Solution

Provisioned concurrency eliminates cold start overhead.

<!-- presenterNote: By pre-warming execution environments, we can maintain consistent response times regardless of traffic patterns. -->
<!-- keyPoints: ["Pre-warm environments", "Consistent response times"] -->

---

# Evidence: Benchmark Results

Performance data shows 10x improvement.

<!-- presenterNote: Our load test with 1000 concurrent users showed P99 latency dropped from 3s to 200ms after enabling provisioned concurrency. -->
<!-- keyPoints: ["P99 from 3s to 200ms", "Tested with 1000 concurrent users"] -->

---

# Summary

Key takeaways from our optimization effort.

<!-- presenterNote: The combination of provisioned concurrency and SnapStart provides a complete solution for cold start elimination in production workloads. -->
<!-- keyPoints: ["Provisioned concurrency + SnapStart", "Complete cold start solution"] -->
`;

const poorlyStructuredDeck = `
# Random Topic

Some content without clear structure.

---

# Another Random Topic

More content with game-changing claims and no evidence.
`;

describe("runEvaluation", () => {
  it("should produce passing report for well-structured deck", () => {
    const report = runEvaluation(wellStructuredDeck, goodFixture);

    expect(report.fixtureId).toBe("test-001");
    expect(report.theme).toBe("technical-explanation");
    expect(report.overallPass).toBe(true);
    expect(report.checks).toHaveLength(4);

    const structureCheck = report.checks.find(
      (c) => c.name === "structure-scoring",
    );
    expect(structureCheck?.passed).toBe(true);

    const noteCheck = report.checks.find(
      (c) => c.name === "note-completeness",
    );
    expect(noteCheck?.passed).toBe(true);
  });

  it("should produce failing report for poorly structured deck", () => {
    const report = runEvaluation(poorlyStructuredDeck, goodFixture);

    expect(report.overallPass).toBe(false);

    // Structure should fail (no clear problem/solution/evidence/summary)
    const structureCheck = report.checks.find(
      (c) => c.name === "structure-scoring",
    );
    expect(structureCheck?.passed).toBe(false);

    // Prohibited expressions should fail
    const prohibitedCheck = report.checks.find(
      (c) => c.name === "prohibited-expressions",
    );
    expect(prohibitedCheck?.passed).toBe(false);
  });

  it("should respect custom thresholds", () => {
    const lenientThresholds: EvaluationThresholds = {
      structureScoreMin: 1,
      noteCompletenessMin: 0,
      maxCharacterViolations: 100,
      maxProhibitedExpressions: 100,
    };

    const report = runEvaluation(poorlyStructuredDeck, goodFixture, {
      thresholds: lenientThresholds,
    });

    expect(report.overallPass).toBe(true);
  });

  it("should include all four check types", () => {
    const report = runEvaluation(wellStructuredDeck, goodFixture);

    const checkNames = report.checks.map((c) => c.name);
    expect(checkNames).toContain("structure-scoring");
    expect(checkNames).toContain("note-completeness");
    expect(checkNames).toContain("character-limits");
    expect(checkNames).toContain("prohibited-expressions");
  });

  it("should use fixture-specific prohibited expressions", () => {
    const fixtureWithCustomProhibited: GoldenSetFixture = {
      ...goodFixture,
      prohibitedExpressions: ["custom forbidden phrase"],
    };

    const mdWithPhrase = `
# Problem

There is a challenge here.

<!-- presenterNote: Note. -->
<!-- keyPoints: ["Point"] -->

---

# Solution

This is our approach with custom forbidden phrase included.

<!-- presenterNote: Note about solution. -->
<!-- keyPoints: ["Point"] -->

---

# Results

Benchmark comparison data.

<!-- presenterNote: Evidence note. -->
<!-- keyPoints: ["Point"] -->

---

# Takeaways

Summary of key points.

<!-- presenterNote: Conclusion note. -->
<!-- keyPoints: ["Point"] -->
`;

    const report = runEvaluation(mdWithPhrase, fixtureWithCustomProhibited);
    const prohibitedCheck = report.checks.find(
      (c) => c.name === "prohibited-expressions",
    );
    expect(prohibitedCheck?.passed).toBe(false);
  });
});
