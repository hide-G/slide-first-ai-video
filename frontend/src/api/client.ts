import { fetchAuthSession } from "aws-amplify/auth";
import type {
  CreateProjectRequest,
  CreateProjectResponse,
  GenerateOutlineRequest,
  GenerateOutlineResponse,
  UpdateOutlineRequest,
  GenerateDeckRequest,
  GenerateDeckResponse,
  SourceUploadUrlRequest,
  SourceUploadUrlResponse,
  RegisterSourceRequest,
  RegisterSourceResponse,
  UpdateOutputRequest,
  GenerateNarrationRequest,
  GenerateNarrationResponse,
  UpdateNarrationRequest,
  StartRenderRequest,
  StartRenderResponse,
  GetRenderResponse,
  GetArtifactsResponse,
  ListProjectsResponse,
  ErrorResponse,
} from "./types.js";

let apiBaseUrl: string | undefined;

export function configureApiClient(apiEndpoint: string): void {
  const withoutTrailingSlashes = apiEndpoint.trim().replace(/\/+$/, "");
  if (!withoutTrailingSlashes) {
    throw new Error("API endpoint is empty");
  }

  apiBaseUrl = withoutTrailingSlashes.replace(/(?:\/v1)+$/i, "");
  if (!apiBaseUrl) {
    throw new Error("API endpoint format is invalid");
  }
}

function getApiBaseUrl(): string {
  if (!apiBaseUrl) {
    throw new Error("Runtime configuration has not been loaded");
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
    // Not authenticated - no header
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
  /** GET /projects */
  listProjects(): Promise<ListProjectsResponse> {
    return request<ListProjectsResponse>("GET", "/v1/projects");
  },

  /** POST /projects */
  createProject(data: CreateProjectRequest): Promise<CreateProjectResponse> {
    return request<CreateProjectResponse>("POST", "/v1/projects", data);
  },

  /** POST /projects/{id}/outline */
  generateOutline(projectId: string, data: GenerateOutlineRequest): Promise<GenerateOutlineResponse> {
    return request<GenerateOutlineResponse>("POST", `/v1/projects/${projectId}/outline`, data);
  },

  /** PUT /projects/{id}/outline */
  updateOutline(projectId: string, data: UpdateOutlineRequest): Promise<void> {
    return request<void>("PUT", `/v1/projects/${projectId}/outline`, data);
  },

  /** POST /projects/{id}/deck */
  generateDeck(projectId: string, data: GenerateDeckRequest): Promise<GenerateDeckResponse> {
    return request<GenerateDeckResponse>("POST", `/v1/projects/${projectId}/deck`, data);
  },

  /** POST /projects/{id}/source-upload-url */
  getSourceUploadUrl(projectId: string, data: SourceUploadUrlRequest): Promise<SourceUploadUrlResponse> {
    return request<SourceUploadUrlResponse>("POST", `/v1/projects/${projectId}/source-upload-url`, data);
  },

  /** POST /projects/{id}/source */
  registerSource(projectId: string, data: RegisterSourceRequest): Promise<RegisterSourceResponse> {
    return request<RegisterSourceResponse>("POST", `/v1/projects/${projectId}/source`, data);
  },

  /** PUT /projects/{id}/output */
  updateOutput(projectId: string, data: UpdateOutputRequest): Promise<void> {
    return request<void>("PUT", `/v1/projects/${projectId}/output`, data);
  },

  /** POST /projects/{id}/narration */
  generateNarration(projectId: string, data: GenerateNarrationRequest): Promise<GenerateNarrationResponse> {
    return request<GenerateNarrationResponse>("POST", `/v1/projects/${projectId}/narration`, data);
  },

  /** PUT /projects/{id}/narration */
  updateNarration(projectId: string, data: UpdateNarrationRequest): Promise<void> {
    return request<void>("PUT", `/v1/projects/${projectId}/narration`, data);
  },

  /** POST /projects/{id}/renders */
  startRender(projectId: string, data: StartRenderRequest): Promise<StartRenderResponse> {
    return request<StartRenderResponse>("POST", `/v1/projects/${projectId}/renders`, data);
  },

  /** GET /projects/{id}/renders/{renderId} */
  getRender(projectId: string, renderId: string): Promise<GetRenderResponse> {
    return request<GetRenderResponse>("GET", `/v1/projects/${projectId}/renders/${renderId}`);
  },

  /** GET /projects/{id}/renders/{renderId}/artifacts */
  getArtifacts(projectId: string, renderId: string): Promise<GetArtifactsResponse> {
    return request<GetArtifactsResponse>("GET", `/v1/projects/${projectId}/renders/${renderId}/artifacts`);
  },
};
