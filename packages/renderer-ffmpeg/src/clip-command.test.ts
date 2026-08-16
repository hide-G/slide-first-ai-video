import { describe, it, expect } from "vitest";
import { buildClipArgs } from "./clip-command.js";

describe("buildClipArgs", () => {
  it("generates correct FFmpeg arguments for a clip", () => {
    const args = buildClipArgs({
      imagePath: "/tmp/page-001.png",
      audioPath: "/tmp/page-001.mp3",
      audioDurationSec: 5.432,
      outputPath: "/tmp/page-001.mp4",
    });

    // Must include -y (overwrite)
    expect(args[0]).toBe("-y");

    // Must use -loop 1 for still image
    expect(args).toContain("-loop");
    expect(args[args.indexOf("-loop") + 1]).toBe("1");

    // Must use -t with measured audioDurationSec (rule 7.1)
    expect(args).toContain("-t");
    expect(args[args.indexOf("-t") + 1]).toBe("5.432");

    // Must use libx264
    expect(args).toContain("libx264");

    // Must use -tune stillimage
    expect(args).toContain("-tune");
    expect(args[args.indexOf("-tune") + 1]).toBe("stillimage");

    // Must use yuv420p
    expect(args).toContain("yuv420p");

    // Must use AAC 96kbps
    expect(args).toContain("aac");
    expect(args).toContain("96k");

    // Must use 24000 sample rate
    expect(args).toContain("24000");

    // Must include -shortest
    expect(args).toContain("-shortest");

    // Must use proper scale/pad video filter
    const vfIdx = args.indexOf("-vf");
    expect(vfIdx).toBeGreaterThan(-1);
    const vf = args[vfIdx + 1];
    expect(vf).toContain("scale=1920:1080");
    expect(vf).toContain("pad=1920:1080");
    expect(vf).toContain("force_original_aspect_ratio=decrease");

    // All args must be strings (no shell injection)
    for (const arg of args) {
      expect(typeof arg).toBe("string");
    }
  });

  it("respects custom width, height, and fps", () => {
    const args = buildClipArgs({
      imagePath: "/tmp/page.png",
      audioPath: "/tmp/page.mp3",
      audioDurationSec: 3.0,
      outputPath: "/tmp/out.mp4",
      width: 1080,
      height: 1920,
      fps: 24,
    });

    const vfIdx = args.indexOf("-vf");
    const vf = args[vfIdx + 1];
    expect(vf).toContain("scale=1080:1920");
    expect(vf).toContain("pad=1080:1920");

    expect(args).toContain("-r");
    expect(args[args.indexOf("-r") + 1]).toBe("24");
  });

  it("formats duration with 3 decimal places", () => {
    const args = buildClipArgs({
      imagePath: "/tmp/page.png",
      audioPath: "/tmp/page.mp3",
      audioDurationSec: 10,
      outputPath: "/tmp/out.mp4",
    });

    const tIdx = args.indexOf("-t");
    expect(args[tIdx + 1]).toBe("10.000");
  });

  it("never contains shell metacharacters in the argument structure", () => {
    const args = buildClipArgs({
      imagePath: "/tmp/page.png",
      audioPath: "/tmp/page.mp3",
      audioDurationSec: 5.5,
      outputPath: "/tmp/out.mp4",
    });

    // No argument should be a shell pipe or redirect
    for (const arg of args) {
      expect(arg).not.toContain("|");
      expect(arg).not.toContain(">>");
      expect(arg).not.toContain("&&");
    }
  });
});
