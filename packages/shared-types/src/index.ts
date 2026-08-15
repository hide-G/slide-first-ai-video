export type {
  VideoRenderer,
  RenderInput,
  RenderPlan,
  ChunkResult,
  RenderOutput,
} from "./video-renderer.js";

export type {
  VideoManifest,
  VoiceConfig,
  OutputConfig,
  CaptionsConfig,
  ManifestSlide,
  TransitionType,
  SlideImportance,
} from "./video-manifest.js";

export type {
  Project,
  Version,
  Job,
  JobStatus,
} from "./project.js";

export type {
  CreateProjectRequest,
  CreateProjectResponse,
  StartRenderRequest,
  StartRenderResponse,
  GetVersionResponse,
  GetJobStatusResponse,
  ListProjectsResponse,
  ErrorResponse,
} from "./api.js";

export type {
  TeaserConfig,
  HookTextCandidate,
  SelectedSlide,
  PostText,
  TeaserGenerationResult,
  SlideCardLayout,
  TeaserGeneratorEvent,
  TeaserCompositionBuilderEvent,
  TeaserCompositionBuilderResult,
} from "./teaser.js";
