/**
 * Safe execFile wrapper for FFmpeg/ffprobe invocation.
 *
 * - Uses child_process.execFile with array args (NEVER shell)
 * - Never passes shell: true
 * - Captures stdout/stderr for error reporting
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export interface ExecOptions {
  /** Maximum time in ms to wait for command completion (default: 300000 = 5 min) */
  timeoutMs?: number;
  /** Maximum buffer size in bytes (default: 10MB) */
  maxBuffer?: number;
}

/**
 * Execute a command safely using execFile (no shell).
 * Throws an error with combined stdout/stderr on non-zero exit.
 */
export async function execFileSafe(
  command: string,
  args: string[],
  options?: ExecOptions,
): Promise<ExecResult> {
  const timeoutMs = options?.timeoutMs ?? 300_000;
  const maxBuffer = options?.maxBuffer ?? 10 * 1024 * 1024;

  try {
    const result = await execFileAsync(command, args, {
      timeout: timeoutMs,
      maxBuffer,
      // Explicitly no shell option
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error: unknown) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      message?: string;
      code?: string | number;
    };
    const message = [
      `Command failed: ${command} ${args.join(" ")}`,
      execError.stderr ? `stderr: ${execError.stderr}` : "",
      execError.stdout ? `stdout: ${execError.stdout}` : "",
      execError.message ? `error: ${execError.message}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    throw new Error(message);
  }
}
