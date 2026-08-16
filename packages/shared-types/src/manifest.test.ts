import { describe, it, expect } from "vitest";
import { ManifestSchema } from "./manifest.js";

function validManifest() {
  return {
    schemaVersion: 1 as const,
    projectId: "p_0001",
    userId: "u_0001",
    contentLanguage: "ja",
    source: { kind: "generated" as const, fileKey: "deck/deck.pdf", pageCount: 2 },
    voice: { id: "Takumi", engine: "neural", languageCode: "ja-JP", sampleRate: "24000" },
    output: {
      aspect: "16:9" as const,
      width: 1920,
      height: 1080,
      fps: 30,
      captions: "burn" as const,
      verticalLayout: null,
      padColor: null,
    },
    lexicon: [{ written: "Kiro Crew", reading: "キロクルー", method: "sub" as const }],
    pages: [
      {
        pageNumber: 1,
        imageKey: "pages/page-001.png",
        script: { mode: "plain" as const, text: "First page narration." },
        audioKey: "audio/page-001.mp3",
        audioDurationSec: 12.5,
        clipKey: "clips/page-001.mp4",
      },
      {
        pageNumber: 2,
        imageKey: "pages/page-002.png",
        script: { mode: "ssml" as const, text: "<speak>Second page.</speak>" },
        audioKey: "audio/page-002.mp3",
        audioDurationSec: 8.3,
        clipKey: "clips/page-002.mp4",
      },
    ],
    stages: {
      pages: "done" as const,
      audio: "done" as const,
      captions: "pending" as const,
      clips: "pending" as const,
      concat: "pending" as const,
    },
  };
}

describe("ManifestSchema", () => {
  it("accepts a valid manifest without cost", () => {
    const result = ManifestSchema.safeParse(validManifest());
    expect(result.success).toBe(true);
  });

  it("accepts a valid manifest with cost", () => {
    const manifest = {
      ...validManifest(),
      cost: {
        currency: "USD",
        priceListFetchedAt: "2026-08-15T00:00:00Z",
        stages: [
          {
            stage: "audio",
            service: "polly",
            usage: { billedCharacters: 921 },
            estimatedCost: 0.0147,
          },
        ],
        estimatedTotal: 0.0147,
        actual: { status: "pending" as const, amount: null, reconciledAt: null },
      },
    };
    const result = ManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });

  it("accepts cost with reconciled status", () => {
    const manifest = {
      ...validManifest(),
      cost: {
        currency: "USD",
        priceListFetchedAt: "2026-08-15T00:00:00Z",
        stages: [],
        estimatedTotal: 0.05,
        actual: {
          status: "reconciled" as const,
          amount: 0.048,
          reconciledAt: "2026-08-16T12:00:00Z",
        },
      },
    };
    const result = ManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });

  it("rejects schemaVersion other than 1", () => {
    const manifest = { ...validManifest(), schemaVersion: 2 };
    const result = ManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it("rejects empty projectId", () => {
    const manifest = { ...validManifest(), projectId: "" };
    const result = ManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid source.kind", () => {
    const manifest = validManifest();
    (manifest.source as Record<string, unknown>).kind = "manual";
    const result = ManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid aspect ratio", () => {
    const manifest = validManifest();
    (manifest.output as Record<string, unknown>).aspect = "2:1";
    const result = ManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid captions option", () => {
    const manifest = validManifest();
    (manifest.output as Record<string, unknown>).captions = "vtt";
    const result = ManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid lexicon method", () => {
    const manifest = validManifest();
    manifest.lexicon[0] = { written: "X", reading: "Y", method: "invalid" as "sub" };
    const result = ManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid script mode", () => {
    const manifest = validManifest();
    (manifest.pages[0].script as Record<string, unknown>).mode = "markdown";
    const result = ManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid stage status", () => {
    const manifest = validManifest();
    (manifest.stages as Record<string, unknown>).pages = "complete";
    const result = ManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it("rejects negative audioDurationSec", () => {
    const manifest = validManifest();
    manifest.pages[0].audioDurationSec = -1;
    const result = ManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it("rejects non-integer pageCount", () => {
    const manifest = validManifest();
    manifest.source.pageCount = 2.5;
    const result = ManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it("rejects zero pageCount", () => {
    const manifest = validManifest();
    manifest.source.pageCount = 0;
    const result = ManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = ManifestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts all valid aspect ratios", () => {
    for (const aspect of ["16:9", "9:16", "1:1", "4:5"] as const) {
      const manifest = validManifest();
      manifest.output.aspect = aspect;
      const result = ManifestSchema.safeParse(manifest);
      expect(result.success).toBe(true);
    }
  });

  it("accepts all valid stage statuses", () => {
    for (const status of ["pending", "running", "done", "failed"] as const) {
      const manifest = validManifest();
      manifest.stages.pages = status;
      const result = ManifestSchema.safeParse(manifest);
      expect(result.success).toBe(true);
    }
  });

  it("accepts uploaded source kind", () => {
    const manifest = validManifest();
    manifest.source.kind = "uploaded";
    const result = ManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });

  it("accepts empty lexicon array", () => {
    const manifest = validManifest();
    manifest.lexicon = [];
    const result = ManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });

  it("accepts verticalLayout with string value", () => {
    const manifest = validManifest();
    manifest.output.verticalLayout = "top";
    const result = ManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });

  it("accepts padColor with string value", () => {
    const manifest = validManifest();
    manifest.output.padColor = "#000000";
    const result = ManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });
});
