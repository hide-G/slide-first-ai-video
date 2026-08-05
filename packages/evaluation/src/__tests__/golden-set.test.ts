import { describe, it, expect } from "vitest";
import { goldenSetFixtures } from "../golden-set/index.js";

describe("golden set fixtures", () => {
  it("should contain exactly 10 fixtures", () => {
    expect(goldenSetFixtures).toHaveLength(10);
  });

  it("should have unique IDs", () => {
    const ids = goldenSetFixtures.map((f) => f.id);
    expect(new Set(ids).size).toBe(10);
  });

  it("should cover all 10 required themes", () => {
    const themes = goldenSetFixtures.map((f) => f.theme);
    expect(themes).toContain("technical-explanation");
    expect(themes).toContain("new-feature-intro");
    expect(themes).toContain("case-study");
    expect(themes).toContain("comparison");
    expect(themes).toContain("tutorial");
    expect(themes).toContain("architecture-overview");
    expect(themes).toContain("best-practices");
    expect(themes).toContain("migration-guide");
    expect(themes).toContain("tool-introduction");
    expect(themes).toContain("performance-optimization");
  });

  it("each fixture should have required fields", () => {
    for (const fixture of goldenSetFixtures) {
      expect(fixture.id).toBeTruthy();
      expect(fixture.theme).toBeTruthy();
      expect(fixture.audience).toBeTruthy();
      expect(fixture.duration).toBeGreaterThan(0);
      expect(fixture.urls).toBeInstanceOf(Array);
      expect(fixture.urls.length).toBeGreaterThan(0);
      expect(fixture.expectedStructure).toHaveProperty("problem");
      expect(fixture.expectedStructure).toHaveProperty("solution");
      expect(fixture.expectedStructure).toHaveProperty("evidence");
      expect(fixture.expectedStructure).toHaveProperty("summary");
      expect(fixture.prohibitedExpressions).toBeInstanceOf(Array);
      expect(fixture.prohibitedExpressions.length).toBeGreaterThan(0);
      expect(fixture.expectedSlideCountRange).toHaveLength(2);
      expect(fixture.expectedSlideCountRange[0]).toBeLessThanOrEqual(
        fixture.expectedSlideCountRange[1],
      );
    }
  });

  it("each fixture should have at least one URL", () => {
    for (const fixture of goldenSetFixtures) {
      expect(fixture.urls.length).toBeGreaterThanOrEqual(1);
      for (const url of fixture.urls) {
        expect(url).toMatch(/^https?:\/\//);
      }
    }
  });
});
