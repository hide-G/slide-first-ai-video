import { describe, it, expect } from "vitest";
import {
  totalDurationSec,
  calculatePageTimings,
  pageStartSec,
} from "./duration.js";

describe("Duration calculations", () => {
  const pages = [
    { pageNumber: 1, audioDurationSec: 5.5 },
    { pageNumber: 2, audioDurationSec: 3.2 },
    { pageNumber: 3, audioDurationSec: 7.8 },
  ];

  describe("totalDurationSec", () => {
    it("sums all page durations", () => {
      expect(totalDurationSec(pages)).toBeCloseTo(16.5, 5);
    });

    it("returns 0 for empty array", () => {
      expect(totalDurationSec([])).toBe(0);
    });

    it("handles single page", () => {
      expect(totalDurationSec([{ audioDurationSec: 4.2 }])).toBeCloseTo(4.2, 5);
    });
  });

  describe("calculatePageTimings", () => {
    it("calculates cumulative start and end for all pages", () => {
      const timings = calculatePageTimings(pages);

      expect(timings).toEqual([
        { pageNumber: 1, audioDurationSec: 5.5, startSec: 0, endSec: 5.5 },
        { pageNumber: 2, audioDurationSec: 3.2, startSec: 5.5, endSec: 8.7 },
        { pageNumber: 3, audioDurationSec: 7.8, startSec: 8.7, endSec: 16.5 },
      ]);
    });

    it("handles empty array", () => {
      expect(calculatePageTimings([])).toEqual([]);
    });

    it("handles single page", () => {
      const timings = calculatePageTimings([{ pageNumber: 1, audioDurationSec: 3.0 }]);
      expect(timings).toEqual([
        { pageNumber: 1, audioDurationSec: 3.0, startSec: 0, endSec: 3.0 },
      ]);
    });
  });

  describe("pageStartSec", () => {
    it("returns 0 for first page (index 0)", () => {
      expect(pageStartSec(pages, 0)).toBe(0);
    });

    it("returns sum of preceding pages for later pages", () => {
      expect(pageStartSec(pages, 1)).toBeCloseTo(5.5, 5);
      expect(pageStartSec(pages, 2)).toBeCloseTo(8.7, 5);
    });

    it("returns total for index beyond array length", () => {
      expect(pageStartSec(pages, 5)).toBeCloseTo(16.5, 5);
    });
  });
});
