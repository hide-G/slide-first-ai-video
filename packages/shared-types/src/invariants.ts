import type { Manifest } from "./manifest.js";

/** 不変条件の検証エラー。 */
export interface InvariantViolation {
  rule: string;
  message: string;
}

/**
 * 指定fpsでのフレーム丸めに許容する最大超過時間をミリ秒で返す。
 * 音声の尺は次フレーム境界へ切り上げるため、超過は最大1フレーム分となる。
 */
export function getFrameExcessLimitMs(fps: number): number {
  return Math.ceil(1000 / fps);
}

/**
 * 構造上の不変条件を検証する。
 *
 * 1. pages.length === source.pageCount
 * 2. audio工程開始後は全script.textが空でない
 * 3. audio工程完了後は全audioDurationSecが正
 * 4. frameAlignedDurationMs >= audioDurationSec * 1000
 * 5. フレーム丸め超過は対象fpsの1フレーム以内
 * 6. pageNumberは1から連番
 */
export function validateInvariants(manifest: Manifest): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  if (manifest.pages.length !== manifest.source.pageCount) {
    violations.push({
      rule: "pages-count",
      message: `pages.length (${manifest.pages.length}) must equal source.pageCount (${manifest.source.pageCount})`,
    });
  }

  const audioActive = manifest.stages.audio === "running" || manifest.stages.audio === "done";
  if (audioActive && manifest.output.narrationMode !== "none") {
    for (const page of manifest.pages) {
      if (!page.script.text || page.script.text.trim().length === 0) {
        violations.push({
          rule: "script-non-empty",
          message: `Page ${page.pageNumber} has empty script.text but audio stage is "${manifest.stages.audio}"`,
        });
      }
    }
  }

  if (manifest.stages.audio === "done") {
    for (const page of manifest.pages) {
      if (page.audioDurationSec <= 0) {
        violations.push({
          rule: "audio-duration-positive",
          message: `Page ${page.pageNumber} has audioDurationSec=${page.audioDurationSec} but audio stage is "done"`,
        });
      }
    }
  }

  if (manifest.stages.audio === "done") {
    const frameExcessLimitMs = getFrameExcessLimitMs(manifest.output.fps);
    for (const page of manifest.pages) {
      if (page.frameAlignedDurationMs > 0 && page.audioDurationSec > 0) {
        const audioMs = page.audioDurationSec * 1000;
        if (page.frameAlignedDurationMs < audioMs) {
          violations.push({
            rule: "frame-aligned-gte-audio",
            message: `Page ${page.pageNumber}: frameAlignedDurationMs (${page.frameAlignedDurationMs}) must be >= audioDurationSec*1000 (${audioMs})`,
          });
        }

        const excess = page.frameAlignedDurationMs - audioMs;
        if (excess > frameExcessLimitMs) {
          violations.push({
            rule: "frame-excess",
            message: `Page ${page.pageNumber}: frame excess ${excess.toFixed(3)}ms exceeds maximum ${frameExcessLimitMs}ms at ${manifest.output.fps}fps`,
          });
        }
      }
    }
  }

  for (let i = 0; i < manifest.pages.length; i++) {
    if (manifest.pages[i].pageNumber !== i + 1) {
      violations.push({
        rule: "page-number-sequential",
        message: `Page at index ${i} has pageNumber=${manifest.pages[i].pageNumber}, expected ${i + 1}`,
      });
    }
  }

  return violations;
}

/** MediaConvertパイプライン共通の許容値。 */
export const TOLERANCES = {
  /** 合計尺の最大差分（ミリ秒） */
  TOTAL_DURATION_MS: 50,
} as const;
