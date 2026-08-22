import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: {
      idToken: { toString: () => "mock-id-token-123" },
    },
  }),
}));

import { apiClient, ApiError, configureApiClient } from "./client.js";

describe("apiClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    configureApiClient("https://api.example.test/v1/");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AuthorizationヘッダーにBearerトークンを付与する", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: [] }),
    });

    await apiClient.listProjects();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer mock-id-token-123",
        }),
      }),
    );
  });

  it("listProjectsでkindと最新レンダリング概要を受け取る", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          projects: [
            {
              projectId: "p1",
              title: "Video project",
              kind: "video",
              status: "RENDERING",
              latestRender: {
                renderId: "r1",
                status: "RUNNING",
                currentStage: "pages",
                currentPage: 2,
                totalPages: 3,
                progressMessage: "ページ 2/3 を処理しています。",
                progressUpdatedAt: "2026-08-15T00:00:01.000Z",
                startedAt: "2026-08-15T00:00:00.000Z",
                updatedAt: "2026-08-15T00:00:01.000Z",
              },
              createdAt: "2026-08-15T00:00:00.000Z",
              updatedAt: "2026-08-15T00:00:01.000Z",
            },
          ],
        }),
    });

    const response = await apiClient.listProjects();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.projects[0]).toMatchObject({
      kind: "video",
      latestRender: {
        renderId: "r1",
        currentPage: 2,
        totalPages: 3,
      },
    });
  });

  it("createProjectでkindをAPIへ送信する", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          project: {
            projectId: "p1",
            title: "Test",
            kind: "slide",
            status: "DRAFT",
            createdAt: "2026-08-15T00:00:00.000Z",
            updatedAt: "2026-08-15T00:00:00.000Z",
          },
        }),
    });

    const response = await apiClient.createProject({
      title: "Test",
      contentLanguage: "ja-JP",
      kind: "slide",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Test",
          contentLanguage: "ja-JP",
          kind: "slide",
        }),
      }),
    );
    expect(response.project.kind).toBe("slide");
  });

  it("generateOutlineで画面言語をAPIのcontentLanguageへ変換する", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          outline: { pages: [] },
          inputTokens: 10,
          outputTokens: 20,
        }),
    });

    await apiClient.generateOutline("p1", {
      contentLang: "ja",
      topic: "Test",
      sourceText: "text",
      referenceUrls: [],
      audience: "devs",
      pages: 5,
      tone: "explanatory",
      theme: "blue",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/p1/outline",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          topic: "Test",
          sourceText: "text",
          referenceUrls: [],
          audience: "devs",
          pages: 5,
          tone: "explanatory",
          theme: "blue",
          contentLanguage: "ja-JP",
        }),
      }),
    );
  });

  it("updateOutlineで画面モデルをAPIのoutline形式へ変換する", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await apiClient.updateOutline("p1", {
      pages: [{ title: "Title", body: "first\n\nsecond", notes: "note" }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/p1/outline",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          outline: [
            {
              pageNumber: 1,
              title: "Title",
              bullets: ["first", "second"],
              presenterNotes: "note",
            },
          ],
        }),
      }),
    );
  });

  it("generateDeckでテーマだけをAPIへ送信する", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          source: {
            kind: "generated",
            fileKey: "users/user-1/projects/p1/deck/deck.pdf",
            pageCount: 2,
          },
          deckKey: "users/user-1/projects/p1/deck/deck.pdf",
          pageCount: 2,
        }),
    });

    await apiClient.generateDeck("p1", { format: ["pdf"], theme: "blue" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/p1/deck",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ theme: "blue" }),
      }),
    );
  });

  it("getSourceUploadUrlでfileNameとfileKey契約を使用する", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          uploadUrl: "https://s3/upload",
          fileKey: "users/user-1/projects/p1/input/source.pdf",
          maxSizeBytes: 100,
        }),
    });

    await apiClient.getSourceUploadUrl("p1", {
      fileName: "deck.pdf",
      contentType: "application/pdf",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/p1/source-upload-url",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          fileName: "deck.pdf",
          contentType: "application/pdf",
        }),
      }),
    );
  });

  it("署名付きS3 URLへのPUTにはAPI認証ヘッダーを送らない", async () => {
    const file = new File(["%PDF"], "deck.pdf", { type: "application/pdf" });
    fetchMock.mockResolvedValue({ ok: true });

    await apiClient.uploadToPresignedUrl("https://s3/upload", file);

    expect(fetchMock).toHaveBeenCalledWith("https://s3/upload", {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: file,
    });
  });

  it("registerSourceでPDF名を含む実APIの契約を送受信する", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          source: {
            kind: "uploaded",
            fileKey: "users/user-1/projects/p1/input/source.pdf",
            fileName: "deck.pdf",
            pageCount: 3,
          },
        }),
    });

    const response = await apiClient.registerSource("p1", {
      kind: "uploaded",
      fileKey: "users/user-1/projects/p1/input/source.pdf",
      fileName: "deck.pdf",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/p1/source",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          kind: "uploaded",
          fileKey: "users/user-1/projects/p1/input/source.pdf",
          fileName: "deck.pdf",
        }),
      }),
    );
    expect(response.source.fileName).toBe("deck.pdf");
  });

  it("updateOutputで出力プロファイルをそのまま保存する", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await apiClient.updateOutput("p1", {
      aspect: "9:16",
      width: 1080,
      height: 1920,
      fps: 60,
      captions: "burn",
      verticalLayout: "top",
      padColor: "navy",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/p1/output",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          aspect: "9:16",
          width: 1080,
          height: 1920,
          fps: 60,
          captions: "burn",
          verticalLayout: "top",
          padColor: "navy",
        }),
      }),
    );
  });

  it("updateNarrationで原稿・辞書・音声を保存する", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    const narration = {
      scripts: [{ pageNumber: 1, mode: "plain" as const, text: "原稿" }],
      lexicon: [{ written: "AWS", reading: "エーダブリューエス", method: "sub" as const }],
      voice: {
        id: "Takumi",
        engine: "neural" as const,
        languageCode: "ja-JP",
        sampleRate: "16000" as const,
      },
    };

    await apiClient.updateNarration("p1", narration);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/p1/narration",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify(narration),
      }),
    );
  });

  it("startRenderを空の開始リクエストで送信する", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          renderId: "r1",
          status: "RUNNING",
          startedAt: "2026-08-15T00:00:00.000Z",
        }),
    });

    await apiClient.startRender("p1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/p1/renders",
      expect.objectContaining({ method: "POST", body: "{}" }),
    );
  });

  it("getRenderで進捗を含む大文字ステータス応答を受け取る", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          renderId: "r1",
          status: "RUNNING",
          currentStage: "audio",
          startedAt: "2026-08-15T00:00:00.000Z",
          updatedAt: "2026-08-15T00:00:01.000Z",
          progress: {
            stage: "audio",
            currentPage: 1,
            totalPages: 3,
            message: "ページ 1/3 のナレーション音声を生成しました。",
            updatedAt: "2026-08-15T00:00:01.000Z",
          },
        }),
    });

    const response = await apiClient.getRender("p1", "r1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/p1/renders/r1",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.progress).toMatchObject({
      stage: "audio",
      currentPage: 1,
      totalPages: 3,
    });
  });

  it("getArtifactsでダウンロード名を含む動画・字幕・音声の成果物一覧を受け取る", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          artifacts: [
            {
              key: "users/user-1/projects/p1/output/r1/video.mp4",
              url: "https://s3/video",
              downloadName: "deck_20260815-090000.mp4",
            },
          ],
        }),
    });

    const response = await apiClient.getArtifacts("p1", "r1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/p1/renders/r1/artifacts",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.artifacts[0]?.downloadName).toBe("deck_20260815-090000.mp4");
  });

  it("非成功レスポンスでApiErrorを送出する", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: "NOT_FOUND", message: "Project not found" }),
    });

    await expect(apiClient.listProjects()).rejects.toMatchObject({
      statusCode: 404,
      errorResponse: { error: "NOT_FOUND" },
    } satisfies Partial<ApiError>);
  });

  it("APIリクエストにContent-Typeヘッダーを含める", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: [] }),
    });

    await apiClient.listProjects();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });
});
