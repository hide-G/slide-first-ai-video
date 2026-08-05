import { describe, it, expect } from "vitest";
import {
  calculateDurationMs,
  calculateStartMs,
  calculateSlideDurations,
} from "./duration.js";

describe("Duration calculations", () => {
  describe("calculateDurationMs", () => {
    it("sums measuredAudioMs + leadInMs + leadOutMs", () => {
      expect(
        calculateDurationMs({
          measuredAudioMs: 5980,
          leadInMs: 120,
          leadOutMs: 400,
        }),
      ).toBe(6500);
    });

    it("handles zero lead times", () => {
      expect(
        calculateDurationMs({
          measuredAudioMs: 3000,
          leadInMs: 0,
          leadOutMs: 0,
        }),
      ).toBe(3000);
    });
  });

  describe("calculateStartMs", () => {
    it("returns 0 for empty array", () => {
      expect(calculateStartMs([])).toBe(0);
    });

    it("sums all preceding durations", () => {
      expect(calculateStartMs([6500, 4200])).toBe(10700);
    });
  });

  describe("calculateSlideDurations", () => {
    it("calculates duration and cumulative start for all slides", () => {
      const slides = [
        { measuredAudioMs: 5980, leadInMs: 120, leadOutMs: 400 },
        { measuredAudioMs: 4000, leadInMs: 100, leadOutMs: 300 },
        { measuredAudioMs: 3200, leadInMs: 150, leadOutMs: 250 },
      ];

      const results = calculateSlideDurations(slides);

      expect(results).toEqual([
        { durationMs: 6500, startMs: 0 },
        { durationMs: 4400, startMs: 6500 },
        { durationMs: 3600, startMs: 10900 },
      ]);
    });

    it("handles single slide", () => {
      const results = calculateSlideDurations([
        { measuredAudioMs: 5000, leadInMs: 100, leadOutMs: 200 },
      ]);

      expect(results).toEqual([{ durationMs: 5300, startMs: 0 }]);
    });
  });
});
