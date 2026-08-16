import { describe, it, expect } from "vitest";
import { alignToFrame, alignToFrameFromSec } from "./frame-alignment.js";

describe("alignToFrame", () => {
  it("aligns 25176ms at 30fps to 25200ms", () => {
    // 25176 / 33.3333... = 755.28 -> ceil = 756 frames
    // 756 * 33.3333... = 25200
    expect(alignToFrame(25176, 30)).toBe(25200);
  });

  it("aligns 27840ms at 30fps to 27867ms", () => {
    // 27840 / 33.3333... = 835.2 -> ceil = 836 frames
    // 836 * 33.3333... = 27866.6666... -> round = 27867
    expect(alignToFrame(27840, 30)).toBe(27867);
  });

  it("returns 0 for 0ms input", () => {
    expect(alignToFrame(0, 30)).toBe(0);
  });

  it("aligns an exact frame boundary to itself", () => {
    // 1000ms at 30fps = 30 frames exactly
    expect(alignToFrame(1000, 30)).toBe(1000);
  });

  it("rounds up even for 1ms over a boundary", () => {
    // 33.3333...ms is 1 frame at 30fps
    // 34ms -> ceil(34 / 33.3333) = ceil(1.02) = 2 frames -> 66.6666... -> round = 67
    expect(alignToFrame(34, 30)).toBe(67);
  });
});

describe("alignToFrameFromSec", () => {
  it("aligns 25.176s at 30fps to 25200ms", () => {
    expect(alignToFrameFromSec(25.176, 30)).toBe(25200);
  });

  it("aligns 27.84s at 30fps to 27867ms", () => {
    expect(alignToFrameFromSec(27.84, 30)).toBe(27867);
  });
});
