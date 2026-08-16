import { describe, it, expect } from "vitest";
import { buildProbeArgs, parseProbeDuration } from "./probe-command.js";

describe("buildProbeArgs", () => {
  it("generates correct ffprobe arguments", () => {
    const args = buildProbeArgs("/tmp/audio.mp3");

    expect(args).toEqual([
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      "/tmp/audio.mp3",
    ]);
  });

  it("all args are strings (no shell)", () => {
    const args = buildProbeArgs("/tmp/file.mp4");
    for (const arg of args) {
      expect(typeof arg).toBe("string");
    }
  });
});

describe("parseProbeDuration", () => {
  it("parses normal duration output", () => {
    expect(parseProbeDuration("12.345\n")).toBe(12.345);
  });

  it("parses duration without newline", () => {
    expect(parseProbeDuration("5.5")).toBe(5.5);
  });

  it("parses integer duration", () => {
    expect(parseProbeDuration("10")).toBe(10);
  });

  it("parses zero duration", () => {
    expect(parseProbeDuration("0.0")).toBe(0.0);
  });

  it("throws on empty string", () => {
    expect(() => parseProbeDuration("")).toThrow("Failed to parse ffprobe duration");
  });

  it("throws on non-numeric output", () => {
    expect(() => parseProbeDuration("N/A")).toThrow("Failed to parse ffprobe duration");
  });

  it("throws on negative duration", () => {
    expect(() => parseProbeDuration("-1.0")).toThrow("Failed to parse ffprobe duration");
  });
});
