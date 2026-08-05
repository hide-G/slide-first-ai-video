import { describe, it, expect } from "vitest";
import { resolveTimings, validateTimings } from "./timing-resolver.js";

describe("resolveTimings", () => {
  it("calculates durationMs = measuredAudioMs + leadInMs + leadOutMs", () => {
    const result = resolveTimings([
      { measuredAudioMs: 5000, leadInMs: 120, leadOutMs: 400 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].durationMs).toBe(5520); // 5000 + 120 + 400
  });

  it("uses default leadInMs=120 and leadOutMs=400 when not specified", () => {
    const result = resolveTimings([{ measuredAudioMs: 3000 }]);

    expect(result[0].leadInMs).toBe(120);
    expect(result[0].leadOutMs).toBe(400);
    expect(result[0].durationMs).toBe(3520); // 3000 + 120 + 400
  });

  it("calculates cumulative startMs for multiple slides", () => {
    const result = resolveTimings([
      { measuredAudioMs: 5000, leadInMs: 120, leadOutMs: 400 }, // duration=5520
      { measuredAudioMs: 3000, leadInMs: 120, leadOutMs: 400 }, // duration=3520
      { measuredAudioMs: 4000, leadInMs: 120, leadOutMs: 400 }, // duration=4520
    ]);

    expect(result[0].startMs).toBe(0);
    expect(result[1].startMs).toBe(5520);
    expect(result[2].startMs).toBe(9040); // 5520 + 3520
  });

  it("first slide always starts at 0", () => {
    const result = resolveTimings([
      { measuredAudioMs: 10000, leadInMs: 200, leadOutMs: 500 },
    ]);
    expect(result[0].startMs).toBe(0);
  });

  it("returns empty array for empty input", () => {
    expect(resolveTimings([])).toEqual([]);
  });

  it("preserves measuredAudioMs in output", () => {
    const result = resolveTimings([
      { measuredAudioMs: 7500, leadInMs: 100, leadOutMs: 300 },
    ]);
    expect(result[0].measuredAudioMs).toBe(7500);
  });

  it("handles single slide correctly", () => {
    const result = resolveTimings([{ measuredAudioMs: 2000 }]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      measuredAudioMs: 2000,
      leadInMs: 120,
      leadOutMs: 400,
      durationMs: 2520,
      startMs: 0,
    });
  });

  it("handles many slides with cumulative math", () => {
    const slides = Array.from({ length: 10 }, (_, i) => ({
      measuredAudioMs: 1000 * (i + 1),
    }));
    const result = resolveTimings(slides);

    // Verify cumulative property: each startMs = previous startMs + previous durationMs
    for (let i = 1; i < result.length; i++) {
      expect(result[i].startMs).toBe(result[i - 1].startMs + result[i - 1].durationMs);
    }
  });
});

describe("validateTimings", () => {
  it("returns true for valid timings", () => {
    const timings = resolveTimings([
      { measuredAudioMs: 5000, leadInMs: 120, leadOutMs: 400 },
      { measuredAudioMs: 3000, leadInMs: 120, leadOutMs: 400 },
    ]);
    expect(validateTimings(timings)).toBe(true);
  });

  it("returns true for empty timings", () => {
    expect(validateTimings([])).toBe(true);
  });

  it("throws for invalid timings with a gap", () => {
    const timings = [
      { measuredAudioMs: 5000, leadInMs: 120, leadOutMs: 400, durationMs: 5520, startMs: 0 },
      { measuredAudioMs: 3000, leadInMs: 120, leadOutMs: 400, durationMs: 3520, startMs: 6000 }, // gap!
    ];
    expect(() => validateTimings(timings)).toThrow("Timing gap/overlap");
  });

  it("throws for invalid timings with overlap", () => {
    const timings = [
      { measuredAudioMs: 5000, leadInMs: 120, leadOutMs: 400, durationMs: 5520, startMs: 0 },
      { measuredAudioMs: 3000, leadInMs: 120, leadOutMs: 400, durationMs: 3520, startMs: 5000 }, // overlap!
    ];
    expect(() => validateTimings(timings)).toThrow("Timing gap/overlap");
  });
});
