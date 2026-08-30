import { describe, expect, it } from "vitest";
import type { ProjectRecord } from "../db/projects.js";
import {
  buildManifestFromProject,
  buildPartialRenderManifestFromProject,
} from "./build-manifest.js";

function makeProject(output: unknown): ProjectRecord {
  return {
    projectId: "project-001",
    userId: "user-001",
    title: "字幕テスト",
    status: "NARRATION_CONFIRMED",
    contentLanguage: "ja-JP",
    source: {
      kind: "uploaded",
      fileKey: "users/user-001/projects/project-001/input/source.pdf",
      pageCount: 1,
    },
    output,
    narration: [{ pageNumber: 1, mode: "plain", text: "1ページ目の原稿です。" }],
    voice: {
      id: "Takumi",
      engine: "neural",
      languageCode: "ja-JP",
      sampleRate: "16000",
    },
    lexicon: [],
    createdAt: "2026-08-15T00:00:00.000Z",
    updatedAt: "2026-08-15T00:00:00.000Z",
  };
}

describe("buildManifestFromProject の字幕設定正規化", () => {
  it("配置設定を持たない既存の縦型上寄せプロジェクトを従来の下端配置として扱う", () => {
    const manifest = buildManifestFromProject(
      makeProject({
        aspect: "9:16",
        fps: 30,
        captions: "burn",
        verticalLayout: "top",
        padColor: "white",
      }),
    );

    expect(manifest.output).toMatchObject({
      captionStyle: "white-outline",
      captionPlacement: "bottom",
      captionSafeAreaYPosition: null,
    });
  });

  it("縦型上寄せで明示された黒板風セーフエリア設定を保持する", () => {
    const manifest = buildManifestFromProject(
      makeProject({
        aspect: "9:16",
        fps: 30,
        captions: "burn",
        verticalLayout: "top",
        padColor: "white",
        captionStyle: "chalkboard",
        captionPlacement: "safe-area",
      }),
    );

    expect(manifest.output).toMatchObject({
      captionStyle: "chalkboard",
      captionPlacement: "safe-area",
      captionSafeAreaYPosition: null,
    });
  });

  it("保存済みの不成立なセーフエリアと黒板風設定を安全な既定値へ正規化する", () => {
    const manifest = buildManifestFromProject(
      makeProject({
        aspect: "16:9",
        fps: 30,
        captions: "burn",
        verticalLayout: null,
        padColor: null,
        captionStyle: "chalkboard",
        captionPlacement: "safe-area",
      }),
    );

    expect(manifest.output).toMatchObject({
      captionStyle: "white-outline",
      captionPlacement: "bottom",
    });
  });

  it.each(["srt", "none"] as const)("保存済みの %s 出力から字幕装飾を除去する", (captions) => {
    const manifest = buildManifestFromProject(
      makeProject({
        aspect: "9:16",
        fps: 30,
        captions,
        verticalLayout: "top",
        padColor: "white",
        captionStyle: "chalkboard",
        captionPlacement: "safe-area",
        captionSafeAreaYPosition: 1182,
      }),
    );

    expect(manifest.output).toMatchObject({
      captions,
      captionStyle: null,
      captionPlacement: null,
      captionSafeAreaYPosition: null,
    });
  });
});

describe("buildManifestFromProject の部分再実行", () => {
  function makeCompletedManifest(
    output = {
      aspect: "9:16",
      fps: 30,
      captions: "burn",
      verticalLayout: "top",
      padColor: "navy",
      captionStyle: "chalkboard",
      captionPlacement: "safe-area",
    },
  ) {
    const manifest = buildManifestFromProject(makeProject(output));
    manifest.output.captionSafeAreaYPosition =
      manifest.output.captionPlacement === "safe-area" ? 1182 : null;
    manifest.pages = manifest.pages.map((page) => ({
      ...page,
      audioDurationSec: 4.2,
      frameAlignedDurationMs: 4233,
    }));
    manifest.stages = {
      pages: "done",
      audio: "done",
      captions: "done",
      video: "done",
    };
    return manifest;
  }

  const matchingOutput = {
    aspect: "9:16",
    fps: 30,
    captions: "burn",
    verticalLayout: "top",
    padColor: "navy",
    captionStyle: "chalkboard",
    captionPlacement: "safe-area",
  };

  it("audioから再実行すると描画済みsafe-areaを保持し、音声以降を再実行用に戻す", () => {
    const manifest = buildManifestFromProject(makeProject(matchingOutput), {
      startStage: "audio",
      previousManifest: makeCompletedManifest(),
    });

    expect(manifest.output.captionSafeAreaYPosition).toBe(1182);
    expect(manifest.pages[0]).toMatchObject({
      audioDurationSec: 0,
      frameAlignedDurationMs: 0,
    });
    expect(manifest.stages).toEqual({
      pages: "done",
      audio: "pending",
      captions: "pending",
      video: "pending",
    });
  });

  it.each([
    ["captions", { pages: "done", audio: "done", captions: "pending", video: "pending" }],
    ["video", { pages: "done", audio: "done", captions: "done", video: "pending" }],
  ] as const)("%sから再実行すると実測音声尺とsafe-areaを保持する", (startStage, stages) => {
    const manifest = buildManifestFromProject(makeProject(matchingOutput), {
      startStage,
      previousManifest: makeCompletedManifest(),
    });

    expect(manifest.output.captionSafeAreaYPosition).toBe(1182);
    expect(manifest.pages[0]).toMatchObject({
      audioDurationSec: 4.2,
      frameAlignedDurationMs: 4233,
    });
    expect(manifest.stages).toEqual(stages);
  });

  it.each([
    ["audio", { pages: "done", audio: "pending", captions: "pending", video: "pending" }],
    ["captions", { pages: "done", audio: "done", captions: "pending", video: "pending" }],
    ["video", { pages: "done", audio: "done", captions: "done", video: "pending" }],
  ] as const)("字幕設定がない旧manifestでも%sから部分再実行できる", (startStage, stages) => {
    const legacyOutput = {
      aspect: "9:16",
      fps: 30,
      captions: "burn",
      verticalLayout: "top",
      padColor: "navy",
    };
    const previousManifest = makeCompletedManifest(legacyOutput);
    previousManifest.output.captionStyle = undefined;
    previousManifest.output.captionPlacement = undefined;

    const manifest = buildManifestFromProject(makeProject(legacyOutput), {
      startStage,
      previousManifest,
    });

    expect(manifest.output).toMatchObject({
      captionStyle: "white-outline",
      captionPlacement: "bottom",
      captionSafeAreaYPosition: null,
    });
    expect(manifest.stages).toEqual(stages);
    expect(manifest.pages[0]).toMatchObject(
      startStage === "audio"
        ? { audioDurationSec: 0, frameAlignedDurationMs: 0 }
        : { audioDurationSec: 4.2, frameAlignedDurationMs: 4233 },
    );
  });

  it("ページ描画に影響する出力設定が変わった部分再実行を拒否する", () => {
    expect(() =>
      buildManifestFromProject(makeProject({ ...matchingOutput, padColor: "white" }), {
        startStage: "audio",
        previousManifest: makeCompletedManifest(),
      }),
    ).toThrow("pagesから再実行してください");
  });
});


describe("buildManifestFromProject のナレーション言語", () => {
  it("保存済みのページ言語と音声プロファイルをmanifestへ渡す", () => {
    const project = makeProject({
      aspect: "16:9",
      fps: 30,
      captions: "burn",
      verticalLayout: null,
      padColor: null,
    });
    project.narrationLanguage = "auto";
    project.narration = [
      {
        pageNumber: 1,
        mode: "plain",
        text: "This page explains the MediaConvert workflow.",
        languageCode: "en-US",
      },
    ];
    project.voiceProfiles = {
      "ja-JP": {
        id: "Takumi",
        engine: "neural",
        languageCode: "ja-JP",
        sampleRate: "16000",
      },
      "en-US": {
        id: "Joanna",
        engine: "neural",
        languageCode: "en-US",
        sampleRate: "16000",
      },
    };

    const manifest = buildManifestFromProject(project);

    expect(manifest.narrationLanguage).toBe("auto");
    expect(manifest.pages[0].script).toMatchObject({ languageCode: "en-US" });
    expect(manifest.voiceProfiles?.["en-US"]).toMatchObject({
      id: "Joanna",
      languageCode: "en-US",
    });
  });

  it("旧manifestの言語コード未保存原稿でもglobal voiceが一致すれば部分再実行できる", () => {
    const output = {
      aspect: "16:9",
      fps: 30,
      captions: "burn",
      verticalLayout: null,
      padColor: null,
    };
    const project = makeProject(output);
    const previous = buildManifestFromProject(project);
    previous.pages[0].script.languageCode = undefined;
    previous.stages = { pages: "done", audio: "done", captions: "done", video: "done" };
    previous.pages[0].audioDurationSec = 3;
    previous.pages[0].frameAlignedDurationMs = 3000;

    expect(() =>
      buildManifestFromProject(project, { startStage: "captions", previousManifest: previous }),
    ).not.toThrow();
  });
});


describe("buildManifestFromProject の実効音声による部分再実行互換性", () => {
  const output = {
    aspect: "16:9",
    fps: 30,
    captions: "burn",
    verticalLayout: null,
    padColor: null,
  };

  function makeJapaneseNarrationProject(): ProjectRecord {
    const project = makeProject(output);
    project.narrationLanguage = "auto";
    project.narration = [
      {
        pageNumber: 1,
        mode: "plain",
        text: "日本語のナレーション原稿です。",
        languageCode: "ja-JP",
      },
    ];
    project.voiceProfiles = {
      "ja-JP": {
        id: "Takumi",
        engine: "neural",
        languageCode: "ja-JP",
        sampleRate: "16000",
      },
      "en-US": {
        id: "Joanna",
        engine: "neural",
        languageCode: "en-US",
        sampleRate: "16000",
      },
    };
    return project;
  }

  function makeCompletedNarrationManifest(project: ProjectRecord) {
    const manifest = buildManifestFromProject(project);
    manifest.pages = manifest.pages.map((page) => ({
      ...page,
      audioDurationSec: 3,
      frameAlignedDurationMs: 3000,
    }));
    manifest.stages = { pages: "done", audio: "done", captions: "done", video: "done" };
    return manifest;
  }

  it("未使用の英語音声プロファイル変更では字幕から部分再実行できる", () => {
    const project = makeJapaneseNarrationProject();
    const previousManifest = makeCompletedNarrationManifest(project);
    project.voiceProfiles = {
      ...project.voiceProfiles,
      "en-US": {
        id: "Matthew",
        engine: "neural",
        languageCode: "en-US",
        sampleRate: "16000",
      },
    };

    expect(() =>
      buildManifestFromProject(project, { startStage: "captions", previousManifest }),
    ).not.toThrow();
  });

  it("実効言語が同じならプロジェクト既定の変更では動画から部分再実行できる", () => {
    const project = makeJapaneseNarrationProject();
    const previousManifest = makeCompletedNarrationManifest(project);
    project.narrationLanguage = "ja-JP";

    expect(() =>
      buildManifestFromProject(project, { startStage: "video", previousManifest }),
    ).not.toThrow();
  });

  it("使用中の日本語音声プロファイルを変更した場合はaudioから部分再実行する", () => {
    const project = makeJapaneseNarrationProject();
    const previousManifest = makeCompletedNarrationManifest(project);
    project.voiceProfiles = {
      ...project.voiceProfiles,
      "ja-JP": {
        id: "Kazuha",
        engine: "neural",
        languageCode: "ja-JP",
        sampleRate: "16000",
      },
    };

    const partial = buildPartialRenderManifestFromProject(project, {
      startStage: "captions",
      previousManifest,
    });

    expect(partial.startStage).toBe("audio");
    expect(partial.manifest.stages).toEqual({
      pages: "done",
      audio: "pending",
      captions: "pending",
      video: "pending",
    });
  });
});