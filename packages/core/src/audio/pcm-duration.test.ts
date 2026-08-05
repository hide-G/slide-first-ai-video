import { describe, it, expect } from "vitest";
import { calculatePcmDurationMs } from "./pcm-duration.js";

describe("calculatePcmDurationMs", () => {
  it("calculates correct duration for known file size (288000 bytes = 6000ms)", () => {
    // 24000 Hz, 16-bit (2 bytes per sample)
    // 288000 / 2 = 144000 samples
    // 144000 / 24000 = 6 seconds = 6000 ms
    const duration = calculatePcmDurationMs(288000);
    expect(duration).toBe(6000);
  });

  it("returns 0 for empty file", () => {
    expect(calculatePcmDurationMs(0)).toBe(0);
  });

  it("calculates 1 second for 48000 bytes", () => {
    // 48000 bytes / 2 = 24000 samples
    // 24000 / 24000 = 1 second = 1000 ms
    expect(calculatePcmDurationMs(48000)).toBe(1000);
  });

  it("throws for negative file size", () => {
    expect(() => calculatePcmDurationMs(-1)).toThrow("File size cannot be negative");
  });

  it("handles fractional milliseconds", () => {
    // 100 bytes / 2 = 50 samples
    // 50 / 24000 * 1000 = 2.0833... ms
    const duration = calculatePcmDurationMs(100);
    expect(duration).toBeCloseTo(2.0833, 3);
  });

  it("respects custom sample rate", () => {
    // 44100 Hz, 2 bytes per sample
    // 88200 bytes / 2 = 44100 samples
    // 44100 / 44100 = 1 second = 1000 ms
    const duration = calculatePcmDurationMs(88200, { sampleRate: 44100 });
    expect(duration).toBe(1000);
  });

  it("respects custom bytes per sample", () => {
    // 24-bit = 3 bytes per sample
    // 72000 bytes / 3 = 24000 samples
    // 24000 / 24000 = 1 second = 1000 ms
    const duration = calculatePcmDurationMs(72000, { bytesPerSample: 3 });
    expect(duration).toBe(1000);
  });

  it("calculates correctly for large files", () => {
    // 10 minutes of audio at 24000 Hz, 16-bit
    // 10 * 60 = 600 seconds
    // 600 * 24000 * 2 = 28800000 bytes
    const duration = calculatePcmDurationMs(28800000);
    expect(duration).toBe(600000); // 600 seconds = 600000 ms
  });
});
