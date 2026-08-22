/** フロントエンドからAPI Gatewayへ送受信するデータ契約。 */

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";
export type CaptionsOption = "burn" | "srt" | "none";
export type NarrationMode = "spoken" | "none";
export type RenderStatus = "RUNNING" | "COMPLETED" | "FAILED";
export type RenderStageName = "pages" | "audio" | "captions" | "video";

export interface RenderProgress {
  stage: RenderStageName;
  currentPage: number;
  totalPages: number;
  message: string;
  updatedAt: string;
}

export interface RenderSummary {
  renderId: string;
  status: RenderStatus;
  startedAt: string;
  updatedAt: string;
  currentStage?: RenderStageName;
  currentPage?: number;
  totalPages?: number;
  progressMessage?: string;
  progressUpdatedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface Project {
  projectId: string;
  userId?: string;
  title: string;
  kind?: "slide" | "video";
  status: string;
  output?: string;
  estimatedCost?: number;
  latestRender?: RenderSummary;
  createdAt: string;
  updatedAt: string;
}

/** スライド画面が使用する表示モデル。 */
export interface OutlinePage {
  title: string;
  body: string;
  notes: string;
}

export interface OutputSettings {
  aspect: AspectRatio;
  fps: 30 | 60;
  subtitleMode: CaptionsOption;
  subtitleSize?: "S" | "M" | "L";
  subtitlePosition?: "bottom" | "center-bottom" | "top";
  voiceId: string;
  engine: "neural" | "standard";
  sampleRate: number;
  speechRate: number;
  verticalLayout?: string;
  verticalBg?: string;
  safeArea?: boolean;
  narrationMode?: NarrationMode;
  silentPageDurationSec?: number;
}

/** 動画画面で編集するページごとの原稿。 */
export interface NarrationPage {
  pageIndex: number;
  mode: "plain" | "ssml";
  script: string;
  /** 原稿の由来。抽出文とAI案はユーザー編集前に置換できる。 */
  origin?: "pdf-extracted" | "ai" | "user";
}

export interface DictionaryEntry {
  word: string;
  reading: string;
  method: "sub" | "phoneme" | "spell";
}

export interface CostEntry {
  stage: string;
  service: string;
  usage: string;
  estimate: string;
}

export interface Artifact {
  key: string;
  size?: number;
  lastModified?: string;
  url: string;
  downloadName?: string;
}

export interface CreateProjectRequest {
  title: string;
  contentLanguage?: string;
  kind?: "slide" | "video";
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
  theme?: string;
}

export interface SourceUploadUrlRequest {
  fileName: string;
  contentType: string;
}

export interface SourceUploadUrlResponse {
  uploadUrl: string;
  fileKey: string;
  maxSizeBytes: number;
}

export interface RegisterSourceRequest {
  kind: "generated" | "uploaded";
  fileKey: string;
  fileName?: string;
}

export interface RegisterSourceResponse {
  source: {
    kind: "generated" | "uploaded";
    fileKey: string;
    pageCount: number;
    fileName?: string;
  };
}

export interface UpdateOutputRequest {
  aspect: AspectRatio;
  width: number;
  height: number;
  fps: 30 | 60;
  captions: CaptionsOption;
  verticalLayout: "top" | "center" | "crop" | null;
  padColor: "white" | "navy" | "auto" | null;
  narrationMode: NarrationMode;
  silentPageDurationSec: number;
}

export interface SaveNarrationRequest {
  scripts: Array<{
    pageNumber: number;
    mode: "plain" | "ssml";
    text: string;
  }>;
  lexicon: Array<{
    written: string;
    reading: string;
    method: "sub" | "phoneme" | "spell";
  }>;
  voice: {
    id: string;
    engine: "neural" | "standard";
    languageCode: string;
    sampleRate: "16000";
  };
}

export interface GenerateNarrationRequest {
  pageNumber: number;
  pageText: string;
}

export interface StartRenderRequest {
  startFromStage?: RenderStageName;
}

export interface StartRenderResponse {
  renderId: string;
  status: RenderStatus;
  startedAt: string;
  executionArn?: string;
}

export interface GetRenderResponse extends RenderSummary {
  progress?: RenderProgress;
}

export interface GetArtifactsResponse {
  artifacts: Artifact[];
}

export interface ListProjectsResponse {
  projects: Project[];
  nextToken?: string;
}

export interface CreateProjectResponse {
  project: Project;
}

/** 既存のスライド画面向けの互換型。 */
export interface GenerateOutlineResponse {
  outline: { pages: OutlinePage[] };
  costs?: CostEntry[];
}

export interface GenerateDeckResponse {
  source?: RegisterSourceResponse["source"];
  deckKey?: string;
  pageCount?: number;
  costs?: CostEntry[];
}

export interface GenerateNarrationResponse {
  script: SaveNarrationRequest["scripts"][number];
  inputTokens?: number;
  outputTokens?: number;
}

export interface ErrorResponse {
  error: string;
  message: string;
}
