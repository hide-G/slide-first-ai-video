/**
 * API request and response types.
 */

import { Project, Version, Job } from "./project.js";

/** Create project request */
export interface CreateProjectRequest {
  title: string;
  description?: string;
  /** Idempotency key for mutation requests */
  idempotencyKey: string;
}

/** Create project response */
export interface CreateProjectResponse {
  project: Project;
}

/** Start render request */
export interface StartRenderRequest {
  projectId: string;
  versionNumber: number;
  outputTypes: string[];
  idempotencyKey: string;
}

/** Start render response */
export interface StartRenderResponse {
  job: Job;
}

/** Get version response */
export interface GetVersionResponse {
  version: Version;
}

/** Get job status response */
export interface GetJobStatusResponse {
  job: Job;
}

/** List projects response */
export interface ListProjectsResponse {
  projects: Project[];
  nextToken?: string;
}

/** Error response */
export interface ErrorResponse {
  error: string;
  message: string;
  requestId?: string;
}
