/**
 * API types for the frontend.
 * Re-exports relevant types from shared-types where possible,
 * and defines frontend-specific API types.
 */

export interface Project {
  projectId: string;
  userId: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Version {
  projectId: string;
  versionNumber: number;
  deckMarkdownKey: string;
  manifestKey?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  jobId: string;
  projectId: string;
  versionNumber: number;
  type: "RENDER" | "GENERATE" | "EXPORT";
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  executionArn?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  title: string;
  theme?: string;
  audience?: string;
  duration?: number;
  urls?: string[];
}

export interface CreateProjectResponse {
  project: Project;
}

export interface StartSlidesRequest {
  theme?: string;
  audience?: string;
  duration?: number;
  urls?: string[];
}

export interface StartSlidesResponse {
  jobId: string;
  projectId: string;
  versionNumber: number;
}

export interface StartVideoRequest {
  versionNumber: number;
  outputTypes?: string[];
}

export interface StartVideoResponse {
  jobId: string;
  projectId: string;
  status: string;
}

export interface GetVersionResponse {
  version: Version;
  markdownContent?: string;
}

export interface GetJobResponse {
  job: Job;
}

export interface Deliverable {
  key: string;
  type: string;
  url: string;
  filename: string;
}

export interface GetDeliverablesResponse {
  deliverables: Deliverable[];
}

export interface ListProjectsResponse {
  projects: Project[];
  nextToken?: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
}
