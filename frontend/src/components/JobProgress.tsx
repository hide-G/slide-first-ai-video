import { useState, useEffect, useRef, useCallback } from "react";
import { apiClient } from "../api/client.js";

interface JobProgressProps {
  jobId: string;
  onComplete?: (jobId: string) => void;
}

const MAX_RETRIES = 3;

/**
 * Job progress component that polls GET /v1/jobs/:jobId every 3s.
 * Tolerates up to 3 consecutive transient failures before stopping.
 */
export function JobProgress({ jobId, onComplete }: JobProgressProps) {
  const [status, setStatus] = useState<string>("PENDING");
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCountRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const pollJob = useCallback(async () => {
    try {
      const response = await apiClient.getJob(jobId);
      retryCountRef.current = 0;
      setError(null);
      setStatus(response.job.status);

      if (
        response.job.status === "SUCCEEDED" ||
        response.job.status === "FAILED" ||
        response.job.status === "CANCELLED"
      ) {
        stopPolling();
        if (response.job.status === "SUCCEEDED" && onComplete) {
          onComplete(jobId);
        }
        if (response.job.status === "FAILED") {
          setError(response.job.error ?? "Job failed");
        }
      }
    } catch (err) {
      retryCountRef.current += 1;
      if (retryCountRef.current >= MAX_RETRIES) {
        setError(
          err instanceof Error ? err.message : "Failed to get job status",
        );
        stopPolling();
      }
    }
  }, [jobId, onComplete, stopPolling]);

  const startPolling = useCallback(() => {
    retryCountRef.current = 0;
    setError(null);
    pollJob();
    intervalRef.current = setInterval(pollJob, 3000);
  }, [pollJob]);

  useEffect(() => {
    startPolling();
    return () => {
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  const handleRetry = () => {
    startPolling();
  };

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
        <div style={{ color: "red", marginTop: "0.5rem" }}>
          {error}
          <button
            onClick={handleRetry}
            style={{
              marginLeft: "0.5rem",
              padding: "0.25rem 0.75rem",
              cursor: "pointer",
              borderRadius: "4px",
              border: "1px solid #ccc",
              background: "#fff",
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
