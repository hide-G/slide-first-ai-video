import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiClient } from "../api/client.js";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [theme, setTheme] = useState("");
  const [audience, setAudience] = useState("");
  const [duration, setDuration] = useState("");
  const [urls, setUrls] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    jobId: string;
    versionNumber: number;
  } | null>(null);

  async function handleStartSlides(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;

    try {
      setGenerating(true);
      setError(null);
      const response = await apiClient.startSlides(id, {
        theme: theme || undefined,
        audience: audience || undefined,
        duration: duration ? Number(duration) : undefined,
        urls: urls
          ? urls
              .split("\n")
              .map((u) => u.trim())
              .filter(Boolean)
          : undefined,
      });
      setResult({
        jobId: response.jobId,
        versionNumber: response.versionNumber,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start slide generation",
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <h1>Project: {id}</h1>

      <nav style={{ marginBottom: "1rem" }}>
        <Link to={`/projects/${id}/videos`}>Videos</Link>
      </nav>

      {error && <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>}

      {result && (
        <div
          style={{
            background: "#e6ffe6",
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "1rem",
          }}
        >
          <p>Slide generation started!</p>
          <Link to={`/projects/${id}/versions/${result.versionNumber}`}>
            View Version {result.versionNumber}
          </Link>
        </div>
      )}

      <h2>Generate Slides</h2>
      <form onSubmit={handleStartSlides}>
        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            Theme:
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="e.g., technology, business"
              style={{ marginLeft: "0.5rem", padding: "0.3rem" }}
            />
          </label>
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            Audience:
            <input
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g., developers, executives"
              style={{ marginLeft: "0.5rem", padding: "0.3rem" }}
            />
          </label>
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            Duration (seconds):
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="60"
              style={{ marginLeft: "0.5rem", padding: "0.3rem" }}
            />
          </label>
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            Reference URLs (one per line):
            <br />
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              rows={3}
              cols={50}
              placeholder="https://example.com/article"
            />
          </label>
        </div>
        <button type="submit" disabled={generating}>
          {generating ? "Generating..." : "Generate Slides"}
        </button>
      </form>
    </div>
  );
}
