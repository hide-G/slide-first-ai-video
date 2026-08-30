import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  getSourceUploadUrl: vi.fn(),
  uploadToPresignedUrl: vi.fn(),
  registerSource: vi.fn(),
  updateOutput: vi.fn(),
  updateNarration: vi.fn(),
  getRender: vi.fn(),
  getArtifacts: vi.fn(),
  startRender: vi.fn(),
}));

const pdfMocks = vi.hoisted(() => ({
  openPdfDocument: vi.fn(),
  extractPdfPageText: vi.fn(),
  renderPdfPagePreview: vi.fn(),
}));

vi.mock("../api/client.js", () => {
  class ApiError extends Error {
    constructor(
      public statusCode: number,
      public errorResponse: { error: string; message: string },
    ) {
      super(errorResponse.message);
      this.name = "ApiError";
    }
  }

  return {
    ApiError,
    apiClient: {
      createProject: apiMocks.createProject,
      getSourceUploadUrl: apiMocks.getSourceUploadUrl,
      uploadToPresignedUrl: apiMocks.uploadToPresignedUrl,
      registerSource: apiMocks.registerSource,
      updateOutput: apiMocks.updateOutput,
      updateNarration: apiMocks.updateNarration,
      getRender: apiMocks.getRender,
      getArtifacts: apiMocks.getArtifacts,
      startRender: apiMocks.startRender,
    },
  };
});

vi.mock("../lib/pdf-preview.js", () => ({
  openPdfDocument: pdfMocks.openPdfDocument,
  extractPdfPageText: pdfMocks.extractPdfPageText,
  renderPdfPagePreview: pdfMocks.renderPdfPagePreview,
}));

import { ApiError } from "../api/client.js";
import { LanguageProvider } from "../i18n/LanguageContext.js";
import {
  resolveCaptionPresentation,
  resolveFailedRenderStage,
  resolveVoiceEngineOptions,
  narrationDraftButtonLabel,
  VideoStudioPage,
} from "./VideoStudioPage.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("resolveCaptionPresentation", () => {
  it("縦型上寄せの焼き込み字幕では黒板風セーフエリアを有効にする", () => {
    const presentation = resolveCaptionPresentation({
      aspect: "9:16",
      verticalLayout: "top",
      subtitleMode: "burn",
      narrationMode: "spoken",
      captionStyle: "chalkboard",
      captionPlacement: "safe-area",
    });

    expect(presentation).toMatchObject({
      isBurnInCaption: true,
      supportsCaptionSafeArea: true,
      effectiveCaptionPlacement: "safe-area",
      usesSafeAreaPlacement: true,
      canUseChalkboard: true,
      effectiveCaptionStyle: "chalkboard",
    });
  });

  it("SRTまたは字幕なしのときはセーフエリア予約と黒板風を無効にする", () => {
    for (const subtitleMode of ["srt", "none"] as const) {
      const presentation = resolveCaptionPresentation({
        aspect: "9:16",
        verticalLayout: "top",
        subtitleMode,
        narrationMode: "spoken",
        captionStyle: "chalkboard",
        captionPlacement: "safe-area",
      });

      expect(presentation).toMatchObject({
        isBurnInCaption: false,
        effectiveCaptionPlacement: "bottom",
        usesSafeAreaPlacement: false,
        canUseChalkboard: false,
        effectiveCaptionStyle: "white-outline",
      });
    }
  });

  it("上寄せ以外の焼き込み字幕では黒板風を白文字・黒縁へ正規化する", () => {
    const presentation = resolveCaptionPresentation({
      aspect: "4:5",
      verticalLayout: "center",
      subtitleMode: "burn",
      narrationMode: "spoken",
      captionStyle: "chalkboard",
      captionPlacement: "safe-area",
    });

    expect(presentation).toMatchObject({
      isBurnInCaption: true,
      supportsCaptionSafeArea: false,
      effectiveCaptionPlacement: "bottom",
      usesSafeAreaPlacement: false,
      canUseChalkboard: false,
      effectiveCaptionStyle: "white-outline",
    });
  });
});

describe("resolveFailedRenderStage", () => {
  it("manifest由来の進捗工程をレンダー記録より優先する", () => {
    expect(
      resolveFailedRenderStage("pages", {
        stage: "audio",
        currentPage: 1,
        totalPages: 2,
        message: "音声を生成しています。",
        updatedAt: "2026-08-15T00:00:00.000Z",
      }),
    ).toBe("audio");
  });

  it("進捗がない場合はレンダー記録を使い、どちらもなければnullを返す", () => {
    expect(resolveFailedRenderStage("captions", undefined)).toBe("captions");
    expect(resolveFailedRenderStage(undefined, undefined)).toBeNull();
  });
});

describe("resolveVoiceEngineOptions", () => {
  it("英語のMatthewにはneuralだけを選択肢にする", () => {
    expect(resolveVoiceEngineOptions("en-US", "Matthew")).toEqual(["neural"]);
  });
});

describe("VideoStudioPageの部分再実行", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    apiMocks.createProject.mockReset();
    apiMocks.getSourceUploadUrl.mockReset();
    apiMocks.uploadToPresignedUrl.mockReset();
    apiMocks.registerSource.mockReset();
    apiMocks.updateOutput.mockReset();
    apiMocks.updateNarration.mockReset();
    apiMocks.getRender.mockReset();
    apiMocks.getArtifacts.mockReset();
    apiMocks.startRender.mockReset();
    pdfMocks.openPdfDocument.mockReset();
    pdfMocks.extractPdfPageText.mockReset();
    pdfMocks.renderPdfPagePreview.mockReset();
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function flushMicrotasks(count = 4): Promise<void> {
    await act(async () => {
      for (let index = 0; index < count; index += 1) {
        await Promise.resolve();
      }
    });
  }

  async function renderFailedVideoStudio(
    currentStage: "pages" | "audio" | "captions" | "video" = "audio",
  ): Promise<void> {
    apiMocks.getRender.mockResolvedValueOnce({
      renderId: "render-001",
      status: "FAILED",
      currentStage,
      startedAt: "2026-08-15T00:00:00.000Z",
      updatedAt: "2026-08-15T00:01:00.000Z",
      error: "RENDER_FAILED",
    });

    await act(async () => {
      root.render(
        <LanguageProvider initialLocale="ja">
          <MemoryRouter initialEntries={["/video?projectId=project-001&renderId=render-001"]}>
            <VideoStudioPage />
          </MemoryRouter>
        </LanguageProvider>,
      );
      await Promise.resolve();
    });
  }

  async function renderUploadReadyVideoStudio(): Promise<void> {
    apiMocks.createProject.mockResolvedValue({ project: { projectId: "project-001" } });
    apiMocks.getSourceUploadUrl.mockResolvedValue({
      uploadUrl: "https://upload.example.com/source.pdf",
      fileKey: "users/user-123/projects/project-001/input/source.pdf",
      maxSizeBytes: 10_000_000,
    });
    apiMocks.uploadToPresignedUrl.mockResolvedValue(undefined);
    apiMocks.registerSource.mockResolvedValue({
      source: {
        kind: "uploaded",
        fileKey: "users/user-123/projects/project-001/input/source.pdf",
        fileName: "slides.pdf",
        pageCount: 1,
      },
    });
    pdfMocks.openPdfDocument.mockResolvedValue({ destroy: vi.fn() });
    pdfMocks.extractPdfPageText.mockResolvedValue("This is an English narration script.");
    pdfMocks.renderPdfPagePreview.mockResolvedValue({
      imageDataUrl: "data:image/png;base64,AA==",
      text: "This is an English narration script.",
    });

    await act(async () => {
      root.render(
        <LanguageProvider initialLocale="ja">
          <MemoryRouter initialEntries={["/video"]}>
            <VideoStudioPage />
          </MemoryRouter>
        </LanguageProvider>,
      );
      await Promise.resolve();
    });

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).toBeDefined();
    const file = new File(["PDF"], "slides.pdf", { type: "application/pdf" });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });

    await act(async () => {
      input?.dispatchEvent(new Event("change", { bubbles: true }));
      for (let index = 0; index < 8; index += 1) {
        await Promise.resolve();
      }
    });
  }

  function findButton(label: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === label,
    );
  }

  function findPrimaryAction(): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll<HTMLButtonElement>(".step-panel button.btn-primary")).find(
      (button) => !button.disabled,
    );
  }

  async function clickPrimaryAction(): Promise<void> {
    const button = findPrimaryAction();
    expect(button).toBeDefined();
    await act(async () => {
      button?.click();
      await Promise.resolve();
    });
  }

  it("失敗した工程をstartFromStageとして再実行する", async () => {
    apiMocks.startRender.mockResolvedValue({
      renderId: "render-002",
      status: "RUNNING",
      startedAt: "2026-08-15T00:02:00.000Z",
    });
    await renderFailedVideoStudio();

    const retryButton = findButton("失敗した工程から再実行");
    expect(retryButton).toBeDefined();

    await act(async () => {
      retryButton?.click();
      await Promise.resolve();
    });

    expect(apiMocks.startRender).toHaveBeenCalledWith("project-001", {
      startFromStage: "audio",
    });
  });

  it("APIがaudioからの再実行を返すと実際の開始工程を進捗へ反映する", async () => {
    apiMocks.startRender.mockResolvedValue({
      renderId: "render-002",
      status: "RUNNING",
      startedAt: "2026-08-15T00:02:00.000Z",
      startFromStage: "audio",
    });
    await renderFailedVideoStudio("video");
    apiMocks.getRender.mockImplementation(() => new Promise(() => undefined));

    await act(async () => {
      findButton("失敗した工程から再実行")?.click();
      await Promise.resolve();
    });

    expect(apiMocks.startRender).toHaveBeenCalledWith("project-001", {
      startFromStage: "video",
    });
    expect(
      Array.from(container.querySelectorAll(".progress-list li")).map((item) =>
        item.getAttribute("data-state"),
      ),
    ).toEqual(["done", "running", "wait", "wait"]);
    expect(container.textContent).toContain(
      "保存済みの設定に合わせて、再利用できる工程から再実行しています。",
    );
  });

  it("部分再実行が409ならpagesからの再実行へ切り替える", async () => {
    apiMocks.startRender.mockRejectedValueOnce(
      new ApiError(409, {
        error: "PARTIAL_RENDER_REQUIRES_PAGES",
        message: "pagesから再実行してください。",
      }),
    );
    apiMocks.startRender.mockResolvedValueOnce({
      renderId: "render-002",
      status: "RUNNING",
      startedAt: "2026-08-15T00:02:00.000Z",
    });
    await renderFailedVideoStudio();

    await act(async () => {
      findButton("失敗した工程から再実行")?.click();
      await Promise.resolve();
    });

    const restartButton = findButton("最初から再実行");
    expect(restartButton).toBeDefined();

    await act(async () => {
      restartButton?.click();
      await Promise.resolve();
    });

    expect(apiMocks.startRender).toHaveBeenNthCalledWith(2, "project-001", {
      startFromStage: "pages",
    });
  });

  it("読み込み済みの設定を保存し終えてから部分再実行を開始する", async () => {
    await renderUploadReadyVideoStudio();
    await clickPrimaryAction();
    await clickPrimaryAction();

    apiMocks.getRender
      .mockResolvedValueOnce({
        renderId: "render-001",
        status: "FAILED",
        currentStage: "audio",
        startedAt: "2026-08-15T00:00:00.000Z",
        updatedAt: "2026-08-15T00:01:00.000Z",
        error: "RENDER_FAILED",
      })
      .mockImplementation(() => new Promise(() => undefined));
    apiMocks.startRender.mockResolvedValueOnce({
      renderId: "render-001",
      status: "RUNNING",
      startedAt: "2026-08-15T00:00:00.000Z",
      startFromStage: "pages",
    });
    await clickPrimaryAction();
    await flushMicrotasks();

    expect(findButton("失敗した工程から再実行")).toBeDefined();
    apiMocks.updateOutput.mockClear();
    apiMocks.updateNarration.mockClear();
    apiMocks.startRender.mockClear();

    let resolveOutput: (() => void) | undefined;
    let resolveNarration: (() => void) | undefined;
    const outputSaved = new Promise<void>((resolve) => {
      resolveOutput = resolve;
    });
    const narrationSaved = new Promise<void>((resolve) => {
      resolveNarration = resolve;
    });
    apiMocks.updateOutput.mockReturnValueOnce(outputSaved);
    apiMocks.updateNarration.mockReturnValueOnce(narrationSaved);
    apiMocks.startRender.mockResolvedValueOnce({
      renderId: "render-002",
      status: "RUNNING",
      startedAt: "2026-08-15T00:02:00.000Z",
      startFromStage: "audio",
    });

    await act(async () => {
      findButton("失敗した工程から再実行")?.click();
      await Promise.resolve();
    });
    expect(apiMocks.updateOutput).toHaveBeenCalledWith("project-001", expect.any(Object));
    expect(apiMocks.updateNarration).not.toHaveBeenCalled();
    expect(apiMocks.startRender).not.toHaveBeenCalled();

    await act(async () => {
      resolveOutput?.();
      await Promise.resolve();
    });
    expect(apiMocks.updateNarration).toHaveBeenCalledWith("project-001", expect.any(Object));
    expect(apiMocks.startRender).not.toHaveBeenCalled();

    await act(async () => {
      resolveNarration?.();
      await Promise.resolve();
    });
    expect(apiMocks.startRender).toHaveBeenCalledWith("project-001", {
      startFromStage: "audio",
    });
  });
});

describe("narrationDraftButtonLabel", () => {
  it("判定済みの言語をAIナレーション案のボタンへ明示する", () => {
    expect(narrationDraftButtonLabel("en-US", false)).toBe(
      "このページに英語のAIナレーション案を挿入",
    );
    expect(narrationDraftButtonLabel("ja-JP", false)).toBe(
      "このページに日本語のAIナレーション案を挿入",
    );
  });

  it("Autoで未判定の場合は言語選択を促す", () => {
    expect(narrationDraftButtonLabel(null, false)).toBe(
      "このページの言語を選択してAIナレーション案を挿入",
    );
  });
});

describe("resolvePageNarrationLanguage", () => {
  it("編集済み原稿をPDF本文より優先し、設定変更とページ上書きを即時に反映する", async () => {
    const { resolvePageNarrationLanguage } = await import("./VideoStudioPage.js");
    const editedPage = {
      mode: "plain" as const,
      script: "これは日本語へ編集したナレーション原稿です。",
      sourceText: "This slide originally contained English source text.",
    };

    expect(resolvePageNarrationLanguage(editedPage, "auto")).toBe("ja-JP");
    expect(resolvePageNarrationLanguage(editedPage, "en-US")).toBe("en-US");
    expect(
      resolvePageNarrationLanguage(
        { ...editedPage, languageOverride: "ja-JP" },
        "en-US",
      ),
    ).toBe("ja-JP");
  });

  it("SSMLのsubは表示本文ではなく可聴aliasでAuto判定する", async () => {
    const { resolvePageNarrationLanguage } = await import("./VideoStudioPage.js");
    const page = {
      mode: "ssml" as const,
      script:
        '<sub alias="Amazon Web Services">アマゾン・ウェブ・サービス</sub> provides cloud services.',
    };

    expect(resolvePageNarrationLanguage(page, "auto")).toBe("en-US");
  });

  it("辞書のsub読みを展開後の可聴テキストでAuto判定する", async () => {
    const { resolvePageNarrationLanguage } = await import("./VideoStudioPage.js");
    const page = { mode: "plain" as const, script: "AWS" };

    expect(
      resolvePageNarrationLanguage(page, "auto", [
        { word: "AWS", reading: "アマゾンウェブサービス", method: "sub" },
      ]),
    ).toBe("ja-JP");
  });
});
