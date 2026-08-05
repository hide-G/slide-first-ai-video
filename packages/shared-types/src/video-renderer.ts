/**
 * Video Renderer port interface.
 * Implementation details are encapsulated behind this boundary.
 */

/**
 * Input to the video rendering pipeline.
 * Uses S3 keys to reference images and audio - no binary data passes through the port.
 */
export interface RenderInput {
  /** S3 key of the video manifest */
  manifestKey: string;
  /** S3 bucket name */
  bucket: string;
  /** Output type identifier (e.g., "lt-full", "x-teaser-16x9") */
  outputType: string;
}

/**
 * Plan produced by the renderer describing how to split work into chunks.
 */
export interface RenderPlan {
  /** Total number of frames to render */
  totalFrames: number;
  /** Number of chunks the work is split into */
  chunkCount: number;
  /** Frames per second */
  fps: number;
  /** Output width in pixels */
  width: number;
  /** Output height in pixels */
  height: number;
  /** Video bitrate in kbps */
  videoBitrateKbps: number;
  /** S3 key prefix for intermediate artifacts */
  intermediatePrefix: string;
  /** Original render input */
  input: RenderInput;
  /** Array of chunk descriptors for Step Functions Map state iteration */
  chunks: RenderChunkDescriptor[];
}

/**
 * Descriptor for a single render chunk, used by the Map state to invoke renderChunk.
 */
export interface RenderChunkDescriptor {
  /** The render plan (without the chunks array to avoid circular reference) */
  plan: Omit<RenderPlan, "chunks">;
  /** Index of the chunk (0-based) */
  chunkIndex: number;
}

/**
 * Result of rendering a single chunk.
 */
export interface ChunkResult {
  /** Index of the chunk (0-based) */
  chunkIndex: number;
  /** S3 key of the rendered chunk artifact */
  artifactKey: string;
  /** Number of frames in this chunk */
  frameCount: number;
}

/**
 * Final output of the rendering pipeline.
 */
export interface RenderOutput {
  /** S3 key of the final MP4 file */
  outputKey: string;
  /** Total duration in milliseconds */
  durationMs: number;
  /** Total number of frames */
  totalFrames: number;
}

/**
 * Video Renderer port.
 * Core logic depends only on this interface.
 * Implementations: HyperframesRenderer (default), FfmpegRenderer (fallback).
 */
export interface VideoRenderer {
  /** Create a plan from input: total frames and chunk division */
  plan(input: RenderInput): Promise<RenderPlan>;
  /** Render a specific chunk and return the S3 key of the intermediate artifact */
  renderChunk(plan: RenderPlan, chunkIndex: number): Promise<ChunkResult>;
  /** Combine intermediate artifacts and audio into the final MP4 */
  assemble(plan: RenderPlan, chunks: ChunkResult[]): Promise<RenderOutput>;
}
