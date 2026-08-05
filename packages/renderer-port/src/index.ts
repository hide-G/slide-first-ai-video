/**
 * VideoRenderer port interface.
 *
 * Re-exports the port interface and all supporting types from shared-types.
 * Implementations (FfmpegRenderer, HyperframesRenderer) depend on this package.
 */
export type {
  VideoRenderer,
  RenderInput,
  RenderPlan,
  ChunkResult,
  RenderOutput,
} from "@slide-first/shared-types";
