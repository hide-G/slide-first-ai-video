/**
 * API types for the frontend matching all 13 API endpoints.
 */

export interface Project {
  projectId: string;
  userId: string;
  title: string;
  kind: "slide" | "video";
  status: "draft" | "running" | "done";
  output?: string;
  estimatedCost?: number;
  createdAt: string;
  updatedAt: string;
}

export interface OutlinePage {
  title: string;
  body: string;
  notes: string;
}

export interface Outline {
  contentLang: "ja" | "en";
  pages: OutlinePage[];
}

export interface OutputSettings {
  aspect: "16:9" | "9:16" | "1:1" | "4:5";
  fps: 30 | 60;
  subtitleMode: "burn" | "srt" | "none";
  subtitleSize?: "S" | "M" | "L";
  subtitlePosition?: "bottom" | "center-bottom" | "top";
  voiceId: string;
  engine: "neural" | "standard";
  sampleRate: number;
  speechRate: number;
  verticalLayout?: string;
  verticalBg?: string;
  safeArea?: boolean;
}

export interface NarrationPage {
  pageIndex: number;
  mode: "plain" | "ssml";
  script: string;
}

export interface DictionaryEntry {
  word: string;
  reading: string;
  method: "sub" | "phoneme" | "spell";
}

export interface Narration {
  pages: NarrationPage[];
  dictionary: DictionaryEntry[];
}

export interface RenderStage {
  name: string;
  state: "wait" | "running" | "done" | "failed";
}

export interface Render {
  renderId: string;
  projectId: string;
  status: "pending" | "running" | "done" | "failed";
  stages: RenderStage[];
  progress: number;
}

export interface CostEntry {
  stage: string;
  service: string;
  usage: string;
  estimate: string;
}

export interface Artifact {
  type: "mp4" | "srt" | "audio" | "markdown" | "pdf" | "pptx";
  url: string;
  filename: string;
  metadata?: Record<string, string>;
}

// Request types
export interface CreateProjectRequest {
  title: string;
  kind: "slide" | "video";
}

export interface GenerateOutlineRequest {
  contentLang: "ja" | "en";
  topic: string;
  sourceText: string;
  referenceUrls: string[];
  audience: string;
  pages: number;
  tone: string;
  theme: string;
}

export interface UpdateOutlineRequest {
  pages: OutlinePage[];
}

export interface GenerateDeckRequest {
  format: ("markdown" | "pdf" | "pptx")[];
}

export interface SourceUploadUrlRequest {
  filename: string;
  contentType: string;
}

export interface RegisterSourceRequest {
  s3Key: string;
  pageCount: number;
}

export interface UpdateOutputRequest {
  settings: OutputSettings;
}

export interface GenerateNarrationRequest {
  pageCount: number;
}

export interface UpdateNarrationRequest {
  narration: Narration;
}

export interface StartRenderRequest {
  outputSettings: OutputSettings;
  narration: Narration;
}

// Response types
export interface ListProjectsResponse {
  projects: Project[];
}

export interface CreateProjectResponse {
  project: Project;
}

export interface GenerateOutlineResponse {
  outline: Outline;
  costs: CostEntry[];
}

export interface GenerateDeckResponse {
  artifacts: Artifact[];
  costs: CostEntry[];
}

export interface SourceUploadUrlResponse {
  uploadUrl: string;
  s3Key: string;
}

export interface RegisterSourceResponse {
  pageCount: number;
  thumbnails: string[];
}

export interface GenerateNarrationResponse {
  narration: Narration;
}

export interface StartRenderResponse {
  render: Render;
}

export interface GetRenderResponse {
  render: Render;
}

export interface GetArtifactsResponse {
  artifacts: Artifact[];
  costs: CostEntry[];
  totalCost: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
}
