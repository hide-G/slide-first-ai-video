import { describe, it, expect } from "vitest";
import { buildConcatArgs, buildConcatListContent, escapeFfmpegPath } from "./concat-command.js";

describe("buildConcatArgs", () => {
  it("generates copy mode args when captions is 'none'", () => {
    const args = buildConcatArgs({
      concatListPath: "/tmp/list.txt",
      outputPath: "/tmp/output.mp4",
      captionsMode: "none",
    });

    expect(args).toContain("-y");
    expect(args).toContain("-f");
    expect(args[args.indexOf("-f") + 1]).toBe("concat");
    expect(args).toContain("-safe");
    expect(args[args.indexOf("-safe") + 1]).toBe("0");
    expect(args).toContain("-c");
    expect(args[args.indexOf("-c") + 1]).toBe("copy");
    expect(args[args.length - 1]).toBe("/tmp/output.mp4");
  });

  it("generates copy mode args when captions is 'srt'", () => {
    const args = buildConcatArgs({
      concatListPath: "/tmp/list.txt",
      outputPath: "/tmp/output.mp4",
      captionsMode: "srt",
    });

    expect(args).toContain("-c");
    expect(args[args.indexOf("-c") + 1]).toBe("copy");
    // Must not have subtitle filter
    expect(args).not.toContain("-vf");
  });

  it("generates subtitle burn args when captions is 'burn'", () => {
    const args = buildConcatArgs({
      concatListPath: "/tmp/list.txt",
      outputPath: "/tmp/output.mp4",
      captionsMode: "burn",
      srtPath: "/tmp/captions.srt",
    });

    expect(args).toContain("-vf");
    const vfIdx = args.indexOf("-vf");
    const vf = args[vfIdx + 1];
    // Must use subtitles filter with escaped file path (NOT drawtext)
    expect(vf).toContain("subtitles=");
    expect(vf).toContain("captions.srt");
    expect(vf).not.toContain("drawtext");

    // Must re-encode with libx264
    expect(args).toContain("libx264");
    expect(args).toContain("aac");
    expect(args).toContain("96k");
  });

  it("throws if captionsMode is 'burn' but no srtPath provided", () => {
    expect(() =>
      buildConcatArgs({
        concatListPath: "/tmp/list.txt",
        outputPath: "/tmp/output.mp4",
        captionsMode: "burn",
      }),
    ).toThrow("srtPath is required");
  });

  it("never contains shell metacharacters", () => {
    const args = buildConcatArgs({
      concatListPath: "/tmp/list.txt",
      outputPath: "/tmp/output.mp4",
      captionsMode: "burn",
      srtPath: "/tmp/captions.srt",
    });

    for (const arg of args) {
      expect(arg).not.toContain("|");
      expect(arg).not.toContain(">>");
      expect(arg).not.toContain("&&");
    }
  });
});

describe("buildConcatListContent", () => {
  it("generates proper concat list format", () => {
    const content = buildConcatListContent([
      "/tmp/clips/page-001.mp4",
      "/tmp/clips/page-002.mp4",
      "/tmp/clips/page-003.mp4",
    ]);

    expect(content).toBe(
      "file '/tmp/clips/page-001.mp4'\nfile '/tmp/clips/page-002.mp4'\nfile '/tmp/clips/page-003.mp4'\n",
    );
  });

  it("handles single clip", () => {
    const content = buildConcatListContent(["/tmp/clip.mp4"]);
    expect(content).toBe("file '/tmp/clip.mp4'\n");
  });
});

describe("escapeFfmpegPath", () => {
  it("wraps simple paths in single quotes", () => {
    const result = escapeFfmpegPath("/tmp/captions.srt");
    expect(result).toBe("'/tmp/captions.srt'");
  });

  it("escapes colons in paths", () => {
    const result = escapeFfmpegPath("/tmp/project:abc/captions.srt");
    expect(result).toContain("\\:");
    expect(result).not.toContain("project:abc");
  });

  it("escapes square brackets in paths", () => {
    const result = escapeFfmpegPath("/tmp/[test]/captions.srt");
    expect(result).toContain("\\[");
    expect(result).toContain("\\]");
  });

  it("escapes semicolons in paths", () => {
    const result = escapeFfmpegPath("/tmp/a;b/captions.srt");
    expect(result).toContain("\\;");
  });

  it("escapes single quotes in paths", () => {
    const result = escapeFfmpegPath("/tmp/it's/captions.srt");
    expect(result).toContain("\\\\'");
  });

  it("escapes backslashes in paths", () => {
    const result = escapeFfmpegPath("/tmp/back\\slash/captions.srt");
    expect(result).toContain("\\\\");
  });
});
