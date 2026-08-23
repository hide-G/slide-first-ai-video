import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getRender: vi.fn(),
  getArtifacts: vi.fn(),
  startRender: vi.fn(),
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
      getRender: apiMocks.getRender,
      getArtifacts: apiMocks.getArtifacts,
      startRender: apiMocks.startRender,
    },
  };
});

import { ApiError } from "../api/client.js";
import { LanguageProvider } from "../i18n/LanguageContext.js";
import {
  resolveCaptionPresentation,
  resolveFailedRenderStage,
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

describe("VideoStudioPageの部分再実行", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    apiMocks.getRender.mockReset();
    apiMocks.getArtifacts.mockReset();
    apiMocks.startRender.mockReset();
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

  async function renderFailedVideoStudio(): Promise<void> {
    apiMocks.getRender.mockResolvedValue({
      renderId: "render-001",
      status: "FAILED",
      currentStage: "audio",
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

  function findButton(label: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === label,
    );
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
});
