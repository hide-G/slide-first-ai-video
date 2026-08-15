import { describe, it, expect } from "vitest";
import {
  estimateHookReadingTimeMs,
  parseHookCandidates,
  validateHookCandidates,
} from "./hook-generator.js";

describe("estimateHookReadingTimeMs", () => {
  it("estimates reading time at 4 words per second", () => {
    // 4 words / 4 wps = 1000ms
    expect(estimateHookReadingTimeMs("One two three four")).toBe(1000);
  });

  it("returns 0 for empty text", () => {
    expect(estimateHookReadingTimeMs("")).toBe(0);
    expect(estimateHookReadingTimeMs("   ")).toBe(0);
  });

  it("handles single word", () => {
    // 1 word / 4 wps = 250ms
    expect(estimateHookReadingTimeMs("Wait")).toBe(250);
  });
});

describe("parseHookCandidates", () => {
  it("parses valid JSON response", () => {
    const response = JSON.stringify({
      hooks: [
        { text: "Mind blown yet?", rank: 1 },
        { text: "You need this", rank: 2 },
        { text: "Game changer", rank: 3 },
      ],
    });

    const result = parseHookCandidates(response);
    expect(result).toHaveLength(3);
    expect(result[0].text).toBe("Mind blown yet?");
    expect(result[0].rank).toBe(1);
    expect(result[0].estimatedReadingTimeMs).toBe(750);
  });

  it("throws on missing hooks array", () => {
    expect(() => parseHookCandidates(JSON.stringify({ foo: "bar" }))).toThrow(
      "missing hooks array",
    );
  });

  it("throws on empty hook text", () => {
    const response = JSON.stringify({
      hooks: [{ text: "", rank: 1 }],
    });
    expect(() => parseHookCandidates(response)).toThrow("empty text");
  });

  it("assigns default rank when missing", () => {
    const response = JSON.stringify({
      hooks: [{ text: "Hello" }, { text: "World" }],
    });
    const result = parseHookCandidates(response);
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
  });
});

describe("validateHookCandidates", () => {
  it("validates hooks under 2 seconds", () => {
    const candidates = [
      { text: "Short hook", estimatedReadingTimeMs: 500, rank: 1 },
      { text: "Another one", estimatedReadingTimeMs: 500, rank: 2 },
    ];
    const result = validateHookCandidates(candidates);
    expect(result.valid).toBe(true);
    expect(result.invalidHooks).toHaveLength(0);
  });

  it("detects hooks exceeding time limit", () => {
    const candidates = [
      { text: "This is way too long for a hook text overlay on screen", estimatedReadingTimeMs: 3000, rank: 1 },
      { text: "OK", estimatedReadingTimeMs: 250, rank: 2 },
    ];
    const result = validateHookCandidates(candidates);
    expect(result.valid).toBe(false);
    expect(result.invalidHooks).toHaveLength(1);
  });
});
