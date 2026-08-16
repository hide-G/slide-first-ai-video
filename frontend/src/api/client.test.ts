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

  it("adds Authorization header with Bearer token", async () => {
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

  it("calls correct path for listProjects", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: [] }),
    });

    await apiClient.listProjects();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("calls correct path for createProject with body", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ project: { projectId: "p1", title: "Test" } }),
    });

    await apiClient.createProject({ title: "Test", kind: "slide" });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/projects"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Test", kind: "slide" }),
      }),
    );
  });

  it("calls correct path for generateOutline", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ outline: { pages: [] }, costs: [] }),
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
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("calls correct path for updateOutline", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await apiClient.updateOutline("p1", { pages: [] });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/p1/outline",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("calls correct path for generateDeck", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ artifacts: [], costs: [] }),
    });

    await apiClient.generateDeck("p1", { format: ["pdf"] });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/p1/deck",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("calls correct path for getSourceUploadUrl", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ uploadUrl: "https://s3/upload", s3Key: "key" }),
    });

    await apiClient.getSourceUploadUrl("p1", { filename: "deck.pdf", contentType: "application/pdf" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/p1/source-upload-url",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("calls correct path for startRender", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ render: { renderId: "r1" } }),
    });

    await apiClient.startRender("p1", {
      outputSettings: {
        aspect: "16:9",
        fps: 30,
        subtitleMode: "burn",
        voiceId: "Takumi",
        engine: "neural",
        sampleRate: 24000,
        speechRate: 100,
      },
      narration: { pages: [], dictionary: [] },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/p1/renders",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("calls correct path for getRender", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ render: { renderId: "r1", status: "running" } }),
    });

    await apiClient.getRender("p1", "r1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/p1/renders/r1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("calls correct path for getArtifacts", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ artifacts: [], costs: [], totalCost: "0.01 USD" }),
    });

    await apiClient.getArtifacts("p1", "r1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/p1/renders/r1/artifacts",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("throws ApiError on non-ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: "NOT_FOUND", message: "Project not found" }),
    });

    try {
      await apiClient.listProjects();
      expect.fail("Should throw ApiError");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).statusCode).toBe(404);
    }
  });

  it("includes Content-Type header in requests", async () => {
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
