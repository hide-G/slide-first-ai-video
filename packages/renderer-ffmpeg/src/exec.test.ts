import { describe, it, expect, vi } from "vitest";
import { execFileSafe } from "./exec.js";

// We mock child_process.execFile to test the wrapper
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import { execFile } from "node:child_process";

describe("execFileSafe", () => {
  it("calls execFile with correct args and returns stdout/stderr", async () => {
    const mockExecFile = vi.mocked(execFile);
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
      // promisify pattern: callback is 3rd or 4th arg
      const cb = typeof _opts === "function" ? _opts : callback;
      (cb as Function)(null, { stdout: "output", stderr: "" });
      return {} as ReturnType<typeof execFile>;
    });

    const result = await execFileSafe("ffmpeg", ["-version"]);
    expect(result.stdout).toBe("output");
    expect(result.stderr).toBe("");

    // Verify it was called without shell option
    expect(mockExecFile).toHaveBeenCalledWith(
      "ffmpeg",
      ["-version"],
      expect.objectContaining({
        timeout: 300_000,
        maxBuffer: 10 * 1024 * 1024,
      }),
      expect.any(Function),
    );

    // Verify no shell option was passed
    const callArgs = mockExecFile.mock.calls[0];
    const opts = callArgs[2] as Record<string, unknown>;
    expect(opts).not.toHaveProperty("shell");
  });

  it("throws error with details on failure", async () => {
    const mockExecFile = vi.mocked(execFile);
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
      const cb = typeof _opts === "function" ? _opts : callback;
      const error = new Error("exit code 1") as Error & { stderr: string; stdout: string };
      error.stderr = "ffmpeg error output";
      error.stdout = "";
      (cb as Function)(error, { stdout: "", stderr: "ffmpeg error output" });
      return {} as ReturnType<typeof execFile>;
    });

    await expect(execFileSafe("ffmpeg", ["-i", "bad.mp4"])).rejects.toThrow(
      "Command failed",
    );
  });
});
