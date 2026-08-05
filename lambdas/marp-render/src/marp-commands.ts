/**
 * Marp CLI command builders.
 * Constructs commands for generating PDF, PPTX, and PNG outputs.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface MarpCommandResult {
  stdout: string;
  stderr: string;
}

/**
 * Execute a marp CLI command with the given arguments.
 */
export async function execMarp(args: string[], cwd: string): Promise<MarpCommandResult> {
  const { stdout, stderr } = await execFileAsync("marp", args, {
    cwd,
    timeout: 120_000,
  });
  return { stdout, stderr };
}

/**
 * Build arguments for generating a PDF from a Marp markdown file.
 * Command: marp --pdf deck.md
 */
export function buildPdfArgs(inputFile: string): string[] {
  return ["--pdf", inputFile];
}

/**
 * Build arguments for generating a PPTX from a Marp markdown file.
 * Command: marp --pptx deck.md
 */
export function buildPptxArgs(inputFile: string): string[] {
  return ["--pptx", inputFile];
}

/**
 * Build arguments for generating PNG images from a Marp markdown file.
 * Command: marp --images png --image-scale 2 deck.md
 */
export function buildPngArgs(inputFile: string): string[] {
  return ["--images", "png", "--image-scale", "2", inputFile];
}

/**
 * Generate PDF output using Marp CLI.
 */
export async function generatePdf(inputFile: string, cwd: string): Promise<MarpCommandResult> {
  return execMarp(buildPdfArgs(inputFile), cwd);
}

/**
 * Generate PPTX output using Marp CLI.
 */
export async function generatePptx(inputFile: string, cwd: string): Promise<MarpCommandResult> {
  return execMarp(buildPptxArgs(inputFile), cwd);
}

/**
 * Generate PNG images using Marp CLI.
 */
export async function generatePng(inputFile: string, cwd: string): Promise<MarpCommandResult> {
  return execMarp(buildPngArgs(inputFile), cwd);
}
