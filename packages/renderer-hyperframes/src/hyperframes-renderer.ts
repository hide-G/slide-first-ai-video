import type {
  VideoRenderer,
  RenderInput,
  RenderPlan,
  ChunkResult,
  RenderOutput,
} from "@slide-first/renderer-port";
import type { VideoManifest } from "@slide-first/shared-types";

/** Default configuration for Hyperframes rendering */
const DEFAULTS = {
  fps: 30,
  width: 1920,
  height: 1080,
  videoBitrateKbps: 5000,
  maxSlidesPerChunk: 5,
} as const;

export interface HyperframesRendererOptions {
  /** Function to fetch the manifest JSON from S3. Required dependency injection. */
  fetchManifest: (bucket: string, key: string) => Promise<VideoManifest>;
}

/**
 * Hyperframes-based VideoRenderer implementation.
 * TODO: Integrate with Hyperframes AWS Lambda when CDK construct is available.
 *
 * Currently only plan() is functional. renderChunk() and assemble() will be
 * implemented when the Hyperframes Lambda deployment is integrated.
 */
export class HyperframesRenderer implements VideoRenderer {
  private readonly fetchManifest: HyperframesRendererOptions["fetchManifest"];

  constructor(options: HyperframesRendererOptions) {
    this.fetchManifest = options.fetchManifest;
  }

  async plan(input: RenderInput): Promise<RenderPlan> {
    const manifest = await this.fetchManifest(input.bucket, input.manifestKey);
    const outputConfig = manifest.outputs[input.outputType];

    const fps = outputConfig?.fps ?? DEFAULTS.fps;
    const width = outputConfig?.width ?? DEFAULTS.width;
    const height = outputConfig?.height ?? DEFAULTS.height;
    const videoBitrateKbps =
      outputConfig?.videoBitrateKbps ?? DEFAULTS.videoBitrateKbps;

    // Calculate total frames from slide durations
    const totalDurationMs = manifest.slides.reduce(
      (sum, slide) => sum + slide.durationMs,
      0,
    );
    const totalFrames = Math.ceil((totalDurationMs * fps) / 1000);

    // Divide slides into chunks
    const chunkCount = Math.max(
      1,
      Math.ceil(manifest.slides.length / DEFAULTS.maxSlidesPerChunk),
    );

    // Build intermediate prefix from manifest key
    const manifestDir = input.manifestKey.replace(/\/[^/]+$/, "");
    const intermediatePrefix = `${manifestDir}/intermediate/${input.outputType}`;

    return {
      totalFrames,
      chunkCount,
      fps,
      width,
      height,
      videoBitrateKbps,
      intermediatePrefix,
      input,
      chunks: Array.from({ length: chunkCount }, (_, i) => ({
        plan: {
          totalFrames,
          chunkCount,
          fps,
          width,
          height,
          videoBitrateKbps,
          intermediatePrefix,
          input,
        },
        chunkIndex: i,
      })),
    };
  }

  async renderChunk(
    _plan: RenderPlan,
    _chunkIndex: number,
  ): Promise<ChunkResult> {
    // TODO: Invoke Hyperframes Lambda for chunk rendering
    throw new Error(
      "Not yet implemented - requires Hyperframes Lambda deployment",
    );
  }

  async assemble(
    _plan: RenderPlan,
    _chunks: ChunkResult[],
  ): Promise<RenderOutput> {
    // TODO: Invoke Hyperframes Lambda for final assembly
    throw new Error(
      "Not yet implemented - requires Hyperframes Lambda deployment",
    );
  }
}
