import { describe, expect, it } from "vitest";
import { ManifestSchema, OUTPUT_PROFILES } from "./manifest.js";

function validManifest() {
  return {
    schemaVersion: 1 as const,
    projectId: "p_0001",
    userId: "u_0001",
    contentLanguage: "ja",
    source: { kind: "generated" as const, fileKey: "deck/deck.pdf", pageCount: 2 },
    voice: {
      id: "Takumi",
      engine: "neural",
      languageCode: "ja-JP",
      sampleRate: "16000",
    },
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
        audioKey: "audio/page-001.wav",
        audioDurationSec: 12.5,
        frameAlignedDurationMs: 12534,
      },
      {
        pageNumber: 2,
        imageKey: "pages/page-002.png",
        script: { mode: "ssml" as const, text: "<speak>Second page.</speak>" },
        audioKey: "audio/page-002.wav",
        audioDurationSec: 8.3,
        frameAlignedDurationMs: 8334,
      },
    ],
    stages: {
      pages: "done" as const,
      audio: "done" as const,
      captions: "pending" as const,
      video: "pending" as const,
    },
  };
}

describe("ManifestSchema", () => {
  it("コスト情報なしの有効なマニフェストを受け入れる", () => {
    expect(ManifestSchema.safeParse(validManifest()).success).toBe(true);
  });

  it("PDF名とページ進捗を含む有効なマニフェストを受け入れる", () => {
    const manifest = {
      ...validManifest(),
      source: {
        ...validManifest().source,
        fileName: "源内ハンズオン_概要編.pdf",
      },
      progress: {
        stage: "audio",
        currentPage: 1,
        totalPages: 2,
        message: "ページ 1/2 のナレーション音声を生成しました。",
        updatedAt: "2026-08-15T00:01:00.000Z",
      },
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source.fileName).toBe("源内ハンズオン_概要編.pdf");
      expect(result.data.progress).toMatchObject({
        stage: "audio",
        currentPage: 1,
        totalPages: 2,
      });
    }
  });

  it("コスト情報を含む有効なマニフェストを受け入れる", () => {
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
    expect(ManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it("すべての出力プロファイルで対応する寸法を受け入れる", () => {
    for (const aspect of ["16:9", "9:16", "1:1", "4:5"] as const) {
      const profile = OUTPUT_PROFILES[aspect];
      const manifest = validManifest();
      manifest.output = {
        ...manifest.output,
        aspect,
        width: profile.width,
        height: profile.height,
      };
      expect(ManifestSchema.safeParse(manifest).success).toBe(true);
    }
  });

  it("30fpsと60fpsを受け入れる", () => {
    for (const fps of [30, 60]) {
      const manifest = validManifest();
      manifest.output.fps = fps;
      expect(ManifestSchema.safeParse(manifest).success).toBe(true);
    }
  });

  it("アスペクト比に一致しない寸法を拒否する", () => {
    const manifest = validManifest();
    manifest.output.aspect = "9:16";
    expect(ManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it("30/60以外のfpsを拒否する", () => {
    const manifest = validManifest();
    manifest.output.fps = 24;
    expect(ManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it("奇数の映像寸法を拒否する", () => {
    const manifest = validManifest();
    manifest.output.width = 1919;
    expect(ManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it("定義済みの縦型レイアウトと余白色を受け入れる", () => {
    const manifest = validManifest();
    manifest.output.verticalLayout = "top";
    manifest.output.padColor = "navy";
    expect(ManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it("未定義の縦型レイアウトと余白色を拒否する", () => {
    const invalidLayout = validManifest();
    (invalidLayout.output as Record<string, unknown>).verticalLayout = "bottom";
    expect(ManifestSchema.safeParse(invalidLayout).success).toBe(false);

    const invalidColor = validManifest();
    (invalidColor.output as Record<string, unknown>).padColor = "#000000";
    expect(ManifestSchema.safeParse(invalidColor).success).toBe(false);
  });

  it("無効な基本値を拒否する", () => {
    const invalidAspect = validManifest();
    (invalidAspect.output as Record<string, unknown>).aspect = "2:1";
    expect(ManifestSchema.safeParse(invalidAspect).success).toBe(false);

    const invalidCaptions = validManifest();
    (invalidCaptions.output as Record<string, unknown>).captions = "vtt";
    expect(ManifestSchema.safeParse(invalidCaptions).success).toBe(false);

    const invalidSource = validManifest();
    (invalidSource.source as Record<string, unknown>).kind = "manual";
    expect(ManifestSchema.safeParse(invalidSource).success).toBe(false);

    const invalidStage = validManifest();
    (invalidStage.stages as Record<string, unknown>).pages = "complete";
    expect(ManifestSchema.safeParse(invalidStage).success).toBe(false);
  });

  it("ページ数・ページ時刻・スキーマバージョンの不正値を拒否する", () => {
    const invalidPageCount = validManifest();
    invalidPageCount.source.pageCount = 0;
    expect(ManifestSchema.safeParse(invalidPageCount).success).toBe(false);

    const invalidDuration = validManifest();
    invalidDuration.pages[0].frameAlignedDurationMs = -1;
    expect(ManifestSchema.safeParse(invalidDuration).success).toBe(false);

    const invalidVersion = { ...validManifest(), schemaVersion: 2 };
    expect(ManifestSchema.safeParse(invalidVersion).success).toBe(false);
  });
});
