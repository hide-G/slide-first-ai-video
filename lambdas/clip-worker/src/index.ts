/**
 * Stage 4: Clips - DEPRECATED.
 * This worker is replaced by MediaConvert in the new pipeline.
 * Will be removed in a future update.
 */

export interface ClipsEvent {
  s3Bucket: string;
  s3Prefix: string;
  projectId: string;
  userId: string;
  renderId: string;
  stage?: string;
}

export interface ClipsResult {
  success: boolean;
  clipCount: number;
  error?: string;
}

export const handler = async (_event: ClipsEvent): Promise<ClipsResult> => {
  return {
    success: false,
    clipCount: 0,
    error: "clip-worker is deprecated. Use MediaConvert video stage instead.",
  };
};
