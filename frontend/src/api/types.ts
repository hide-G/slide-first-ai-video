/** フロントエンドからAPI Gatewayへ送受信するデータ契約。 */

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";
export type CaptionsOption = "burn" | "srt" | "none";
export type CaptionStylePreset =
  | "white-outline"
  | "yellow-outline"
  | "black-background"
  | "chalkboard";
export type CaptionPlacement = "bottom" | "safe-area";
export type NarrationMode = "spoken" | "none";
export type NarrationLanguageCode = "ja-JP" | "en-US";
export type NarrationLanguageSetting = "auto" | NarrationLanguageCode;
export type RenderStatus = "RUNNING" | "COMPLETED" | "FAILED";
export type RenderStageName = "pages" | "audio" | "captions" | "video";

export interface VoiceProfile {
  id: string;
  engine: "neural" | "standard";
  languageCode: NarrationLanguageCode;
  sampleRate: "16000";
}

export type VoiceProfiles = Record<NarrationLanguageCode, VoiceProfile>;

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
  narrationLanguage?: NarrationLanguageSetting;
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
  captionStyle?: CaptionStylePreset;
  captionPlacement?: CaptionPlacement;
  narrationMode?: NarrationMode;
  silentPageDurationSec?: number;
}

/** 動画画面で編集するページごとの原稿。 */
export interface NarrationPage {
  pageIndex: number;
  mode: "plain" | "ssml";
  script: string;
  /** PDFから抽出した元の本文。原稿欄が空の場合のみAuto判定の補助に使う。 */
  sourceText?: string;
  /** プロジェクト設定を上書きするページ単位の言語。 */
  languageOverride?: NarrationLanguageCode;
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
  narrationLanguage?: NarrationLanguageSetting;
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
  captionStyle: CaptionStylePreset | null;
  captionPlacement: CaptionPlacement | null;
  narrationMode: NarrationMode;
  silentPageDurationSec: number;
}

export interface SaveNarrationRequest {
  scripts: Array<{
    pageNumber: number;
    mode: "plain" | "ssml";
    text: string;
    languageOverride?: NarrationLanguageCode;
    languageCode: NarrationLanguageCode;
  }>;
  lexicon: Array<{
    written: string;
    reading: string;
    method: "sub" | "phoneme" | "spell";
  }>;
  /** 旧プロジェクトとの互換性を保つグローバル音声。 */
  voice: VoiceProfile;
  /** ページごとの解決済み言語でPollyを選べるようにする。 */
  voiceProfiles: VoiceProfiles;
  narrationLanguage: NarrationLanguageSetting;
}

export interface GenerateNarrationRequest {
  pageNumber: number;
  pageText: string;
  narrationLanguage: NarrationLanguageSetting;
  languageOverride?: NarrationLanguageCode;
}

export interface StartRenderRequest {
  startFromStage?: RenderStageName;
}

export interface StartRenderResponse {
  renderId: string;
  status: RenderStatus;
  startedAt: string;
  /** APIが部分再実行の互換性に応じて実際に開始した工程。 */
  startFromStage: RenderStageName;
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
