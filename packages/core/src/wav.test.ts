import { describe, it, expect } from "vitest";
import { calculatePcmDurationSec, createWavHeader } from "./wav.js";

describe("calculatePcmDurationSec", () => {
  it("calculates 25.2 seconds for 1,209,600 bytes at 24kHz/16bit/mono", () => {
    // 1,209,600 / (2 * 1 * 24000) = 1,209,600 / 48,000 = 25.2
    const duration = calculatePcmDurationSec(1_209_600, 24000, 16, 1);
    expect(duration).toBe(25.2);
  });

  it("calculates correctly for stereo 44.1kHz/16bit", () => {
    // 176,400 bytes / (2 * 2 * 44100) = 176,400 / 176,400 = 1.0 second
    const duration = calculatePcmDurationSec(176_400, 44100, 16, 2);
    expect(duration).toBe(1.0);
  });

  it("returns 0 for 0 bytes", () => {
    expect(calculatePcmDurationSec(0, 24000, 16, 1)).toBe(0);
  });
});

describe("createWavHeader", () => {
  it("produces a 44-byte buffer", () => {
    const header = createWavHeader(1_209_600, 24000, 16, 1);
    expect(header.length).toBe(44);
  });

  it("starts with RIFF magic", () => {
    const header = createWavHeader(1_209_600, 24000, 16, 1);
    expect(header.toString("ascii", 0, 4)).toBe("RIFF");
  });

  it("contains WAVE format", () => {
    const header = createWavHeader(1_209_600, 24000, 16, 1);
    expect(header.toString("ascii", 8, 12)).toBe("WAVE");
  });

  it("contains fmt sub-chunk", () => {
    const header = createWavHeader(1_209_600, 24000, 16, 1);
    expect(header.toString("ascii", 12, 16)).toBe("fmt ");
  });

  it("contains data sub-chunk", () => {
    const header = createWavHeader(1_209_600, 24000, 16, 1);
    expect(header.toString("ascii", 36, 40)).toBe("data");
  });

  it("sets correct ChunkSize (file size - 8)", () => {
    const pcmLen = 1_209_600;
    const header = createWavHeader(pcmLen, 24000, 16, 1);
    // ChunkSize = 36 + dataSize
    expect(header.readUInt32LE(4)).toBe(36 + pcmLen);
  });

  it("sets AudioFormat to 1 (PCM)", () => {
    const header = createWavHeader(1_209_600, 24000, 16, 1);
    expect(header.readUInt16LE(20)).toBe(1);
  });

  it("sets correct sample rate", () => {
    const header = createWavHeader(1_209_600, 24000, 16, 1);
    expect(header.readUInt32LE(24)).toBe(24000);
  });

  it("sets correct byte rate for 24kHz/16bit/mono", () => {
    const header = createWavHeader(1_209_600, 24000, 16, 1);
    // byteRate = 24000 * 1 * 2 = 48000
    expect(header.readUInt32LE(28)).toBe(48000);
  });

  it("sets correct block align", () => {
    const header = createWavHeader(1_209_600, 24000, 16, 1);
    // blockAlign = 1 * 2 = 2
    expect(header.readUInt16LE(32)).toBe(2);
  });

  it("sets correct bits per sample", () => {
    const header = createWavHeader(1_209_600, 24000, 16, 1);
    expect(header.readUInt16LE(34)).toBe(16);
  });

  it("sets correct data sub-chunk size", () => {
    const pcmLen = 1_209_600;
    const header = createWavHeader(pcmLen, 24000, 16, 1);
    expect(header.readUInt32LE(40)).toBe(pcmLen);
  });
});
