/**
 * Project and Version domain types.
 */

/** Job status */
export type JobStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

/** Project entity */
export interface Project {
  projectId: string;
  userId: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** Version entity */
export interface Version {
  projectId: string;
  versionNumber: number;
  deckMarkdownKey: string;
  manifestKey?: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
}

/** Job entity representing an async processing task */
export interface Job {
  jobId: string;
  projectId: string;
  versionNumber: number;
  type: "RENDER" | "GENERATE" | "EXPORT";
  status: JobStatus;
  /** Step Functions execution ARN */
  executionArn?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
