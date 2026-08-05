import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { runCli } from "../cli.js";

describe("runCli", () => {
  const baselineDir = path.resolve(__dirname, "../../baselines");

  it("should exit 0 when baselines pass evaluation", () => {
    const exitCode = runCli([
      "node",
      "cli.js",
      "--baseline-dir",
      baselineDir,
    ]);
    expect(exitCode).toBe(0);
  });

  it("should exit 0 when no baselines are found", () => {
    const exitCode = runCli([
      "node",
      "cli.js",
      "--baseline-dir",
      "/tmp/nonexistent-dir",
    ]);
    expect(exitCode).toBe(0);
  });

  it("should support verbose flag", () => {
    const exitCode = runCli([
      "node",
      "cli.js",
      "--baseline-dir",
      baselineDir,
      "--verbose",
    ]);
    expect(exitCode).toBe(0);
  });
});
