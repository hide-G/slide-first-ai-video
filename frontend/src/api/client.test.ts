import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock aws-amplify/auth
vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: {
      idToken: { toString: () => "mock-id-token-123" },
    },
  }),
}));

import { apiClient, ApiError } from "./client.js";

describe("apiClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
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
      expect.stringContaining("/v1/projects"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("calls correct path for createProject with body", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ project: { projectId: "p1", title: "Test" } }),
    });

    await apiClient.createProject({ title: "Test" });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/projects"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Test" }),
      }),
    );
  });

  it("calls correct path for startTeaser", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ jobId: "j1", projectId: "p1", status: "PENDING" }),
    });

    await apiClient.startTeaser("p1", { versionNumber: 1 });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/projects/p1/videos/teaser"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ versionNumber: 1 }),
      }),
    );
  });

  it("throws ApiError on non-ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: () =>
        Promise.resolve({ error: "NOT_FOUND", message: "Project not found" }),
    });

    try {
      await apiClient.listProjects();
      expect.fail("Expected ApiError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).statusCode).toBe(404);
    }
  });

  it("calls correct path for getJob", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          job: { jobId: "j1", status: "RUNNING" },
        }),
    });

    await apiClient.getJob("j1");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/jobs/j1"),
      expect.objectContaining({ method: "GET" }),
    );
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
