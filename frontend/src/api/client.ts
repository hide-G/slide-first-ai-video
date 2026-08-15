import { fetchAuthSession } from "aws-amplify/auth";
import { createLocalizedError } from "../i18n/errors.js";
import type {
  CreateProjectRequest,
  CreateProjectResponse,
  StartSlidesRequest,
  StartSlidesResponse,
  StartVideoRequest,
  StartVideoResponse,
  GetVersionResponse,
  GetJobResponse,
  GetDeliverablesResponse,
  ListProjectsResponse,
  ErrorResponse,
} from "./types.js";

let apiBaseUrl: string | undefined;

/**
 * APIのオリジンを設定する。誤ってstageを含む値が渡されても、/v1はクライアント側で一度だけ付与する。
 */
export function configureApiClient(apiEndpoint: string): void {
  const withoutTrailingSlashes = apiEndpoint.trim().replace(/\/+$/, "");
  if (!withoutTrailingSlashes) {
    throw createLocalizedError("errors.apiEndpointEmpty");
  }

  apiBaseUrl = withoutTrailingSlashes.replace(/(?:\/v1)+$/i, "");
  if (!apiBaseUrl) {
    throw createLocalizedError("errors.apiEndpointInvalid");
  }
}

function getApiBaseUrl(): string {
  if (!apiBaseUrl) {
    throw createLocalizedError("errors.apiRuntimeConfigNotLoaded");
  }

  return apiBaseUrl;
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public errorResponse: ErrorResponse,
  ) {
    super(errorResponse.message);
    this.name = "ApiError";
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    if (idToken) {
      return { Authorization: `Bearer ${idToken}` };
    }
  } catch {
    // 未認証の場合はAuthorizationヘッダーを付与しない。
  }
  return {};
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await getAuthHeaders()),
  };

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = (await response.json()) as ErrorResponse;
    throw new ApiError(response.status, errorBody);
  }

  return (await response.json()) as T;
}

export const apiClient = {
  /** プロジェクト一覧を取得する。 */
  listProjects(): Promise<ListProjectsResponse> {
    return request<ListProjectsResponse>("GET", "/v1/projects");
  },

  /** プロジェクトを作成する。 */
  createProject(data: CreateProjectRequest): Promise<CreateProjectResponse> {
    return request<CreateProjectResponse>("POST", "/v1/projects", data);
  },

  /** スライド生成を開始する。 */
  startSlides(
    projectId: string,
    data: StartSlidesRequest,
  ): Promise<StartSlidesResponse> {
    return request<StartSlidesResponse>(
      "POST",
      `/v1/projects/${projectId}/slides`,
      data,
    );
  },

  /** バージョン詳細を取得する。 */
  getVersion(
    projectId: string,
    versionNumber: number,
  ): Promise<GetVersionResponse> {
    return request<GetVersionResponse>(
      "GET",
      `/v1/projects/${projectId}/versions/${versionNumber}`,
    );
  },

  /** バージョンを承認する。 */
  approveVersion(projectId: string, versionNumber: number): Promise<void> {
    return request<void>(
      "POST",
      `/v1/projects/${projectId}/versions/${versionNumber}/approve`,
    );
  },

  /** 完成版の動画生成を開始する。 */
  startVideo(
    projectId: string,
    data: StartVideoRequest,
  ): Promise<StartVideoResponse> {
    return request<StartVideoResponse>(
      "POST",
      `/v1/projects/${projectId}/videos`,
      data,
    );
  },

  /** ティーザー動画生成を開始する。 */
  startTeaser(
    projectId: string,
    data: StartVideoRequest,
  ): Promise<StartVideoResponse> {
    return request<StartVideoResponse>(
      "POST",
      `/v1/projects/${projectId}/videos/teaser`,
      data,
    );
  },

  /** ジョブ状態を取得する。 */
  getJob(jobId: string): Promise<GetJobResponse> {
    return request<GetJobResponse>("GET", `/v1/jobs/${jobId}`);
  },

  /** 成果物を取得する。 */
  getDeliverables(projectId: string): Promise<GetDeliverablesResponse> {
    return request<GetDeliverablesResponse>(
      "GET",
      `/v1/projects/${projectId}/deliverables`,
    );
  },
};
