/**
 * Typed API client wrapping fetch with Authorization header.
 */

import { fetchAuthSession } from "aws-amplify/auth";
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

const API_BASE_URL =
  import.meta.env.VITE_API_ENDPOINT ?? "";

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
    // Not authenticated
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
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
  /** List all projects */
  listProjects(): Promise<ListProjectsResponse> {
    return request<ListProjectsResponse>("GET", "/v1/projects");
  },

  /** Create a new project */
  createProject(data: CreateProjectRequest): Promise<CreateProjectResponse> {
    return request<CreateProjectResponse>("POST", "/v1/projects", data);
  },

  /** Start slide generation */
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

  /** Get version details */
  getVersion(
    projectId: string,
    versionNumber: number,
  ): Promise<GetVersionResponse> {
    return request<GetVersionResponse>(
      "GET",
      `/v1/projects/${projectId}/versions/${versionNumber}`,
    );
  },

  /** Approve a version */
  approveVersion(projectId: string, versionNumber: number): Promise<void> {
    return request<void>(
      "POST",
      `/v1/projects/${projectId}/versions/${versionNumber}/approve`,
    );
  },

  /** Start full video generation */
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

  /** Start teaser video generation */
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

  /** Get job status */
  getJob(jobId: string): Promise<GetJobResponse> {
    return request<GetJobResponse>("GET", `/v1/jobs/${jobId}`);
  },

  /** Get deliverables */
  getDeliverables(projectId: string): Promise<GetDeliverablesResponse> {
    return request<GetDeliverablesResponse>(
      "GET",
      `/v1/projects/${projectId}/deliverables`,
    );
  },
};
