#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import { goldenSetFixtures } from "./golden-set/index.js";
import { runEvaluation, RunnerOptions } from "./runner.js";
import { EvaluationReport, DEFAULT_THRESHOLDS } from "./types.js";

interface CliArgs {
  baselineDir: string;
  verbose: boolean;
}

function getDefaultBaselineDir(): string {
  // Use __dirname which is available in Node16 module resolution
  return path.resolve(__dirname, "../baselines");
}

function parseArgs(argv: string[]): CliArgs {
  let baselineDir = getDefaultBaselineDir();
  let verbose = false;

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--baseline-dir" && argv[i + 1]) {
      baselineDir = path.resolve(argv[i + 1]);
      i++;
    } else if (argv[i] === "--verbose" || argv[i] === "-v") {
      verbose = true;
    }
  }

  return { baselineDir, verbose };
}

function loadBaseline(baselineDir: string, fixtureId: string): string | null {
  const filePath = path.join(baselineDir, `${fixtureId}.md`);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf-8");
  }
  return null;
}

export function runCli(argv: string[] = process.argv): number {
  const args = parseArgs(argv);

  console.log("=== Golden Set Evaluation ===");
  console.log(`Baseline directory: ${args.baselineDir}`);
  console.log(`Fixtures: ${goldenSetFixtures.length}`);
  console.log("");

  const reports: EvaluationReport[] = [];
  let skipped = 0;

  const options: RunnerOptions = {
    thresholds: DEFAULT_THRESHOLDS,
    skipUrlCheck: true,
  };

  for (const fixture of goldenSetFixtures) {
    const markdown = loadBaseline(args.baselineDir, fixture.id);

    if (!markdown) {
      if (args.verbose) {
        console.log(`[SKIP] ${fixture.id} (${fixture.theme}): no baseline found`);
      }
      skipped++;
      continue;
    }

    const report = runEvaluation(markdown, fixture, options);
    reports.push(report);

    const status = report.overallPass ? "PASS" : "FAIL";
    console.log(`[${status}] ${fixture.id} (${fixture.theme})`);

    if (args.verbose) {
      for (const check of report.checks) {
        const checkStatus = check.passed ? "  OK" : "FAIL";
        console.log(`  [${checkStatus}] ${check.name}`);
        if (!check.passed) {
          console.log(`         ${JSON.stringify(check.details)}`);
        }
      }
    }
  }

  console.log("");
  console.log("=== Summary ===");
  const passed = reports.filter((r) => r.overallPass).length;
  const failed = reports.filter((r) => !r.overallPass).length;
  console.log(
    `Passed: ${passed}, Failed: ${failed}, Skipped: ${skipped}, Total fixtures: ${goldenSetFixtures.length}`,
  );

  if (failed > 0) {
    console.log("");
    console.log("EVALUATION FAILED: Thresholds breached.");
    return 1;
  }

  if (reports.length === 0) {
    console.log("");
    console.log("WARNING: No baselines found. Place .md files in the baseline directory.");
    return 0;
  }

  console.log("");
  console.log("EVALUATION PASSED: All checks within thresholds.");
  return 0;
}

// Execute CLI when run directly
if (require.main === module) {
  const exitCode = runCli();
  process.exit(exitCode);
}
