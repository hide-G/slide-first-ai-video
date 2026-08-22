import { describe, expect, it } from "vitest";
import { getFrameExcessLimitMs, TOLERANCES, validateInvariants } from "./invariants.js";
import type { Manifest } from "./manifest.js";

function validManifest(): Manifest {
  return {
    schemaVersion: 1,
    projectId: "p_0001",
    userId: "u_0001",
    contentLanguage: "ja",
    source: { kind: "generated", fileKey: "deck/deck.pdf", pageCount: 2 },
    voice: { id: "Takumi", engine: "neural", languageCode: "ja-JP", sampleRate: "16000" },
    output: {
      aspect: "16:9",
      width: 1920,
      height: 1080,
      fps: 30,
      captions: "burn",
      verticalLayout: null,
      padColor: null,
    },
    lexicon: [],
    pages: [
      {
        pageNumber: 1,
        imageKey: "pages/page-001.png",
        script: { mode: "plain", text: "First page." },
        audioKey: "audio/page-001.wav",
        audioDurationSec: 12.5,
        frameAlignedDurationMs: 12534,
      },
      {
        pageNumber: 2,
        imageKey: "pages/page-002.png",
        script: { mode: "plain", text: "Second page." },
        audioKey: "audio/page-002.wav",
        audioDurationSec: 8.3,
        frameAlignedDurationMs: 8334,
      },
    ],
    stages: { pages: "done", audio: "done", captions: "done", video: "done" },
  };
}

describe("validateInvariants", () => {
  it("有効なマニフェストでは違反を返さない", () => {
    expect(validateInvariants(validManifest())).toHaveLength(0);
  });

  it("ページ数と連番の不整合を検出する", () => {
    const manifest = validManifest();
    manifest.source.pageCount = 3;
    manifest.pages[1].pageNumber = 5;

    const rules = validateInvariants(manifest).map((violation) => violation.rule);
    expect(rules).toContain("pages-count");
    expect(rules).toContain("page-number-sequential");
  });

  it("audio工程中・完了後の空原稿と未計測音声を検出する", () => {
    const manifest = validManifest();
    manifest.stages.audio = "done";
    manifest.pages[0].script.text = "";
    manifest.pages[0].audioDurationSec = 0;
    manifest.pages[0].frameAlignedDurationMs = 0;

    const rules = validateInvariants(manifest).map((violation) => violation.rule);
    expect(rules).toContain("script-non-empty");
    expect(rules).toContain("audio-duration-positive");
  });

  it("音声工程開始前の空原稿は検証対象にしない", () => {
    const manifest = validManifest();
    manifest.stages.audio = "pending";
    manifest.pages[0].script.text = "";
    manifest.pages[0].audioDurationSec = 0;
    manifest.pages[0].frameAlignedDurationMs = 0;
    manifest.pages[1].audioDurationSec = 0;
    manifest.pages[1].frameAlignedDurationMs = 0;

    expect(
      validateInvariants(manifest).filter((violation) => violation.rule === "script-non-empty"),
    ).toHaveLength(0);
  });

  it("音声より短いフレーム尺を検出する", () => {
    const manifest = validManifest();
    manifest.pages[0].frameAlignedDurationMs = 12400;

    expect(validateInvariants(manifest)).toContainEqual(
      expect.objectContaining({ rule: "frame-aligned-gte-audio" }),
    );
  });

  it("30fpsでは最大34ms、60fpsでは最大17msの超過を許容する", () => {
    const at30fps = validManifest();
    at30fps.pages[0].frameAlignedDurationMs = 12534;
    expect(
      validateInvariants(at30fps).filter((violation) => violation.rule === "frame-excess"),
    ).toHaveLength(0);

    const at60fps = validManifest();
    at60fps.output.fps = 60;
    at60fps.pages[0].frameAlignedDurationMs = 12517;
    at60fps.pages[1].frameAlignedDurationMs = 8317;
    expect(
      validateInvariants(at60fps).filter((violation) => violation.rule === "frame-excess"),
    ).toHaveLength(0);
  });

  it("対象fpsの1フレームを超える超過を検出する", () => {
    const manifest = validManifest();
    manifest.output.fps = 60;
    manifest.pages[0].frameAlignedDurationMs = 12518;

    expect(validateInvariants(manifest)).toContainEqual(
      expect.objectContaining({ rule: "frame-excess" }),
    );
  });
});

describe("許容値", () => {
  it("合計尺の許容差は50msである", () => {
    expect(TOLERANCES.TOTAL_DURATION_MS).toBe(50);
  });

  it("fpsに応じた1フレームの許容差を返す", () => {
    expect(getFrameExcessLimitMs(30)).toBe(34);
    expect(getFrameExcessLimitMs(60)).toBe(17);
  });
});
