import { describe, it, expect } from "vitest";
import { validateInvariants, TOLERANCES } from "./invariants.js";
import type { Manifest } from "./manifest.js";

function validManifest(): Manifest {
  return {
    schemaVersion: 1,
    projectId: "p_0001",
    userId: "u_0001",
    contentLanguage: "ja",
    source: { kind: "generated", fileKey: "deck/deck.pdf", pageCount: 2 },
    voice: { id: "Takumi", engine: "neural", languageCode: "ja-JP", sampleRate: "24000" },
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
    stages: {
      pages: "done",
      audio: "done",
      captions: "done",
      video: "done",
    },
  };
}

describe("validateInvariants", () => {
  it("returns no violations for a valid manifest", () => {
    const violations = validateInvariants(validManifest());
    expect(violations).toHaveLength(0);
  });

  it("detects pages.length !== source.pageCount", () => {
    const manifest = validManifest();
    manifest.source.pageCount = 3; // but only 2 pages
    const violations = validateInvariants(manifest);
    expect(violations).toContainEqual(
      expect.objectContaining({ rule: "pages-count" })
    );
  });

  it("detects empty script.text when audio is running", () => {
    const manifest = validManifest();
    manifest.stages.audio = "running";
    manifest.pages[0].script.text = "";
    const violations = validateInvariants(manifest);
    expect(violations).toContainEqual(
      expect.objectContaining({ rule: "script-non-empty" })
    );
  });

  it("detects empty script.text when audio is done", () => {
    const manifest = validManifest();
    manifest.stages.audio = "done";
    manifest.pages[1].script.text = "   "; // whitespace only
    const violations = validateInvariants(manifest);
    expect(violations).toContainEqual(
      expect.objectContaining({ rule: "script-non-empty" })
    );
  });

  it("does not flag empty script when audio is pending", () => {
    const manifest = validManifest();
    manifest.stages.audio = "pending";
    manifest.pages[0].script.text = "";
    manifest.pages[0].audioDurationSec = 0;
    manifest.pages[0].frameAlignedDurationMs = 0;
    manifest.pages[1].audioDurationSec = 0;
    manifest.pages[1].frameAlignedDurationMs = 0;
    const violations = validateInvariants(manifest);
    // No script-non-empty violation expected
    const scriptViolations = violations.filter((v) => v.rule === "script-non-empty");
    expect(scriptViolations).toHaveLength(0);
  });

  it("detects zero audioDurationSec when audio is done", () => {
    const manifest = validManifest();
    manifest.stages.audio = "done";
    manifest.pages[0].audioDurationSec = 0;
    manifest.pages[0].frameAlignedDurationMs = 0;
    const violations = validateInvariants(manifest);
    expect(violations).toContainEqual(
      expect.objectContaining({ rule: "audio-duration-positive" })
    );
  });

  it("detects non-sequential page numbers", () => {
    const manifest = validManifest();
    manifest.pages[1].pageNumber = 5;
    const violations = validateInvariants(manifest);
    expect(violations).toContainEqual(
      expect.objectContaining({ rule: "page-number-sequential" })
    );
  });

  it("detects frameAlignedDurationMs less than audioDurationSec*1000", () => {
    const manifest = validManifest();
    manifest.pages[0].audioDurationSec = 12.5;
    manifest.pages[0].frameAlignedDurationMs = 12400; // less than 12500
    const violations = validateInvariants(manifest);
    expect(violations).toContainEqual(
      expect.objectContaining({ rule: "frame-aligned-gte-audio" })
    );
  });

  it("detects frame excess exceeding FRAME_EXCESS_MS", () => {
    const manifest = validManifest();
    manifest.pages[0].audioDurationSec = 12.5;
    manifest.pages[0].frameAlignedDurationMs = 12600; // excess = 100ms > 34ms
    const violations = validateInvariants(manifest);
    expect(violations).toContainEqual(
      expect.objectContaining({ rule: "frame-excess" })
    );
  });

  it("allows frame excess within FRAME_EXCESS_MS", () => {
    const manifest = validManifest();
    // audioDurationSec = 12.5 -> 12500ms, frameAligned = 12534 -> excess = 34ms (exactly at limit)
    manifest.pages[0].audioDurationSec = 12.5;
    manifest.pages[0].frameAlignedDurationMs = 12534;
    const violations = validateInvariants(manifest);
    const excessViolations = violations.filter((v) => v.rule === "frame-excess");
    expect(excessViolations).toHaveLength(0);
  });

  it("can detect multiple violations at once", () => {
    const manifest = validManifest();
    manifest.source.pageCount = 5; // mismatch
    manifest.stages.audio = "done";
    manifest.pages[0].script.text = ""; // empty
    manifest.pages[0].audioDurationSec = 0; // zero
    manifest.pages[0].frameAlignedDurationMs = 0;
    const violations = validateInvariants(manifest);
    expect(violations.length).toBeGreaterThanOrEqual(3);
  });
});

describe("TOLERANCES", () => {
  it("has correct total duration tolerance in ms", () => {
    expect(TOLERANCES.TOTAL_DURATION_MS).toBe(50);
  });

  it("has correct frame excess tolerance in ms", () => {
    expect(TOLERANCES.FRAME_EXCESS_MS).toBe(34);
  });
});
