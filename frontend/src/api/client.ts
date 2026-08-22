import { fetchAuthSession } from "aws-amplify/auth";
import type {
  CreateProjectRequest,
  CreateProjectResponse,
  GenerateDeckRequest,
  GenerateDeckResponse,
  GenerateNarrationRequest,
  GenerateNarrationResponse,
  GenerateOutlineRequest,
  GenerateOutlineResponse,
  GetArtifactsResponse,
  GetRenderResponse,
  ListProjectsResponse,
  RegisterSourceRequest,
  RegisterSourceResponse,
  SaveNarrationRequest,
  SourceUploadUrlRequest,
  SourceUploadUrlResponse,
  StartRenderRequest,
  StartRenderResponse,
  UpdateOutlineRequest,
  UpdateOutputRequest,
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
    // 未認証時はAuthorizationヘッダーを付けず、APIの認可応答に委ねる。
  }
  return {};
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(await getAuthHeaders()),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    let errorBody: ErrorResponse;
    try {
      errorBody = (await response.json()) as ErrorResponse;
    } catch {
      errorBody = { error: "REQUEST_FAILED", message: "API request failed" };
    }
    throw new ApiError(response.status, errorBody);
  }

  return (await response.json()) as T;
}

/** 署名付きS3 URLへPDFをアップロードする。API認証ヘッダーは送らない。 */
async function uploadToPresignedUrl(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: file,
  });
  if (!response.ok) {
    throw new Error("PDFのアップロードに失敗しました。");
  }
}

export const apiClient = {
  listProjects(): Promise<ListProjectsResponse> {
    return request<ListProjectsResponse>("GET", "/v1/projects");
  },

  createProject(data: CreateProjectRequest): Promise<CreateProjectResponse> {
    return request<CreateProjectResponse>("POST", "/v1/projects", {
      title: data.title,
      ...(data.contentLanguage ? { contentLanguage: data.contentLanguage } : {}),
      ...(data.kind ? { kind: data.kind } : {}),
    });
  },

  generateOutline(
    projectId: string,
    data: GenerateOutlineRequest,
  ): Promise<GenerateOutlineResponse> {
    return request<GenerateOutlineResponse>("POST", `/v1/projects/${projectId}/outline`, {
      topic: data.topic,
      sourceText: data.sourceText,
      referenceUrls: data.referenceUrls,
      audience: data.audience,
      pages: data.pages,
      tone: data.tone,
      theme: data.theme,
      contentLanguage: data.contentLang === "ja" ? "ja-JP" : "en-US",
    });
  },

  updateOutline(projectId: string, data: UpdateOutlineRequest): Promise<void> {
    return request<void>("PUT", `/v1/projects/${projectId}/outline`, {
      outline: data.pages.map((page, index) => ({
        pageNumber: index + 1,
        title: page.title || `Slide ${index + 1}`,
        bullets: page.body
          .split("\n")
          .map((bullet) => bullet.trim())
          .filter(Boolean),
        presenterNotes: page.notes,
      })),
    });
  },

  generateDeck(projectId: string, data: GenerateDeckRequest): Promise<GenerateDeckResponse> {
    return request<GenerateDeckResponse>("POST", `/v1/projects/${projectId}/deck`, {
      ...(data.theme ? { theme: data.theme } : {}),
    });
  },

  getSourceUploadUrl(
    projectId: string,
    data: SourceUploadUrlRequest,
  ): Promise<SourceUploadUrlResponse> {
    return request<SourceUploadUrlResponse>(
      "POST",
      `/v1/projects/${projectId}/source-upload-url`,
      data,
    );
  },

  uploadToPresignedUrl,

  registerSource(projectId: string, data: RegisterSourceRequest): Promise<RegisterSourceResponse> {
    return request<RegisterSourceResponse>("POST", `/v1/projects/${projectId}/source`, data);
  },

  updateOutput(projectId: string, data: UpdateOutputRequest): Promise<void> {
    return request<void>("PUT", `/v1/projects/${projectId}/output`, data);
  },

  generateNarration(
    projectId: string,
    data: GenerateNarrationRequest,
  ): Promise<GenerateNarrationResponse> {
    return request<GenerateNarrationResponse>("POST", `/v1/projects/${projectId}/narration`, data);
  },

  updateNarration(projectId: string, data: SaveNarrationRequest): Promise<void> {
    return request<void>("PUT", `/v1/projects/${projectId}/narration`, data);
  },

  startRender(projectId: string, data: StartRenderRequest = {}): Promise<StartRenderResponse> {
    return request<StartRenderResponse>("POST", `/v1/projects/${projectId}/renders`, data);
  },

  getRender(projectId: string, renderId: string): Promise<GetRenderResponse> {
    return request<GetRenderResponse>("GET", `/v1/projects/${projectId}/renders/${renderId}`);
  },

  getArtifacts(projectId: string, renderId: string): Promise<GetArtifactsResponse> {
    return request<GetArtifactsResponse>(
      "GET",
      `/v1/projects/${projectId}/renders/${renderId}/artifacts`,
    );
  },
};
