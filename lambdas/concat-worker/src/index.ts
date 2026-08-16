/**
 * Stage 5: Concat - DEPRECATED.
 * This worker is replaced by MediaConvert in the new pipeline.
 * Will be removed in a future update.
 */

export interface ConcatEvent {
  s3Bucket: string;
  s3Prefix: string;
  projectId: string;
  userId: string;
  renderId: string;
  stage?: string;
}

export interface ConcatResult {
  success: boolean;
  outputKey: string;
  totalDuration: number;
  error?: string;
}

export const handler = async (_event: ConcatEvent): Promise<ConcatResult> => {
  return {
    success: false,
    outputKey: "",
    totalDuration: 0,
    error: "concat-worker is deprecated. Use MediaConvert video stage instead.",
  };
};
