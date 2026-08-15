import { useCallback } from "react";
import { config } from "../config";

/** API呼び出しフック。認証トークンを自動付与する。 */
export function useApi(idToken: string | null) {
  const request = useCallback(
    async <T>(method: string, path: string, body?: unknown): Promise<T> => {
      if (!idToken) throw new Error("未認証です");

      const url = `${config.apiEndpoint}${path}`;
      const options: RequestInit = {
        method,
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
      };

      if (body && method !== "GET") {
        options.headers = {
          ...options.headers,
          "Idempotency-Key": crypto.randomUUID(),
        } as Record<string, string>;
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API Error: ${response.status}`);
      }
      return data as T;
    },
    [idToken],
  );

  const createProject = useCallback(
    (params: {
      title: string;
      theme?: string;
      audience?: string;
      duration?: number;
      urls?: string[];
    }) => request<{ projectId: string }>("POST", "/projects", params),
    [request],
  );

  const startSlides = useCallback(
    (projectId: string, params?: { theme?: string; audience?: string }) =>
      request<{ jobId: string }>("POST", `/projects/${projectId}/slides`, params || {}),
    [request],
  );

  const getJob = useCallback(
    (jobId: string) =>
      request<{
        jobId: string;
        status: string;
        progress?: number;
        error?: string;
      }>("GET", `/jobs/${jobId}`),
    [request],
  );

  const getVersion = useCallback(
    (projectId: string, version: number) =>
      request<{
        projectId: string;
        versionNumber: number;
        status: string;
        slideCount?: number;
        markdown?: string;
      }>("GET", `/projects/${projectId}/versions/${version}`),
    [request],
  );

  const approveVersion = useCallback(
    (projectId: string, version: number) =>
      request<{ status: string }>(
        "POST",
        `/projects/${projectId}/versions/${version}/approve`,
        {},
      ),
    [request],
  );

  const startVideo = useCallback(
    (projectId: string, versionNumber: number) =>
      request<{ jobId: string }>("POST", `/projects/${projectId}/videos`, {
        versionNumber,
        outputTypes: ["mp4"],
      }),
    [request],
  );

  const getDeliverables = useCallback(
    (projectId: string) =>
      request<{
        deliverables: { type: string; filename: string; url: string }[];
      }>("GET", `/projects/${projectId}/deliverables`),
    [request],
  );

  return {
    createProject,
    startSlides,
    getJob,
    getVersion,
    approveVersion,
    startVideo,
    getDeliverables,
  };
}
