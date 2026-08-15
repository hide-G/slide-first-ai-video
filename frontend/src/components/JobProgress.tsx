import { useState, useEffect, useRef } from "react";
import { apiClient } from "../api/client.js";

interface JobProgressProps {
  jobId: string;
  onComplete?: (jobId: string) => void;
}

/**
 * Job progress component that polls GET /v1/jobs/:jobId every 3s.
 */
export function JobProgress({ jobId, onComplete }: JobProgressProps) {
  const [status, setStatus] = useState<string>("PENDING");
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    pollJob();
    intervalRef.current = setInterval(pollJob, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [jobId]);

  async function pollJob() {
    try {
      const response = await apiClient.getJob(jobId);
      setStatus(response.job.status);

      if (
        response.job.status === "SUCCEEDED" ||
        response.job.status === "FAILED" ||
        response.job.status === "CANCELLED"
      ) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        if (response.job.status === "SUCCEEDED" && onComplete) {
          onComplete(jobId);
        }
        if (response.job.status === "FAILED") {
          setError(response.job.error ?? "Job failed");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get job status");
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  }

  const isRunning = status === "PENDING" || status === "RUNNING";
  const progressColor =
    status === "SUCCEEDED"
      ? "#4CAF50"
      : status === "FAILED"
        ? "#f44336"
        : "#2196F3";

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "1rem",
        marginBottom: "1rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <strong>Job:</strong> {jobId}
      </div>
      <div style={{ marginTop: "0.5rem" }}>
        <span
          style={{
            display: "inline-block",
            padding: "0.25rem 0.5rem",
            borderRadius: "4px",
            background: progressColor,
            color: "white",
            fontSize: "0.875rem",
          }}
        >
          {status}
        </span>
        {isRunning && (
          <span style={{ marginLeft: "0.5rem" }}>Processing...</span>
        )}
      </div>
      {error && (
        <div style={{ color: "red", marginTop: "0.5rem" }}>{error}</div>
      )}
    </div>
  );
}
