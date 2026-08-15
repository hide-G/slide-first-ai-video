import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { apiClient } from "../api/client.js";
import { JobProgress } from "../components/JobProgress.js";
import { VideoPlayer } from "../components/VideoPlayer.js";
import { DeliverablesList } from "../components/DeliverablesList.js";

export function VideosPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const versionNumber = Number(searchParams.get("version")) || 1;
  const [jobId, setJobId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  async function handleStartVideo() {
    if (!id) return;
    try {
      setStarting(true);
      setError(null);
      const response = await apiClient.startVideo(id, { versionNumber });
      setJobId(response.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start video");
    } finally {
      setStarting(false);
    }
  }

  async function handleStartTeaser() {
    if (!id) return;
    try {
      setStarting(true);
      setError(null);
      const response = await apiClient.startTeaser(id, { versionNumber });
      setJobId(response.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start teaser");
    } finally {
      setStarting(false);
    }
  }

  function handleJobComplete(completedJobId: string) {
    // After job completes, we can show deliverables
    setJobId(completedJobId);
  }

  return (
    <div>
      <h1>Videos</h1>

      {error && <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>}

      <div style={{ marginBottom: "1rem" }}>
        <button
          onClick={handleStartVideo}
          disabled={starting}
          style={{ marginRight: "0.5rem" }}
        >
          {starting ? "Starting..." : "Generate Full Video"}
        </button>
        <button onClick={handleStartTeaser} disabled={starting}>
          {starting ? "Starting..." : "Generate Teaser"}
        </button>
      </div>

      {jobId && (
        <JobProgress jobId={jobId} onComplete={handleJobComplete} />
      )}

      {videoUrl && <VideoPlayer url={videoUrl} />}

      {id && (
        <DeliverablesList
          projectId={id}
          onVideoSelect={(url) => setVideoUrl(url)}
        />
      )}
    </div>
  );
}
