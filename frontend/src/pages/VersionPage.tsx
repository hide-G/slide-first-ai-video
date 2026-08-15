import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiClient } from "../api/client.js";
import { MarkdownPreview } from "../components/MarkdownPreview.js";
import type { Version } from "../api/types.js";

export function VersionPage() {
  const { id, version } = useParams<{ id: string; version: string }>();
  const navigate = useNavigate();
  const [versionData, setVersionData] = useState<Version | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (id && version) {
      loadVersion();
    }
  }, [id, version]);

  async function loadVersion() {
    try {
      setLoading(true);
      const response = await apiClient.getVersion(id!, Number(version!));
      setVersionData(response.version);
      setMarkdownContent(response.markdownContent ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load version");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!id || !version) return;
    try {
      setApproving(true);
      setError(null);
      await apiClient.approveVersion(id, Number(version));
      // Navigate to videos page after approval
      navigate(`/projects/${id}/videos`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve version");
    } finally {
      setApproving(false);
    }
  }

  if (loading) {
    return <div>Loading version...</div>;
  }

  if (error) {
    return <div style={{ color: "red" }}>{error}</div>;
  }

  return (
    <div>
      <h1>
        Version {version} - {versionData?.status}
      </h1>

      {versionData?.status === "SLIDE_READY" && (
        <button
          onClick={handleApprove}
          disabled={approving}
          style={{
            background: "#4CAF50",
            color: "white",
            padding: "0.5rem 1rem",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            marginBottom: "1rem",
          }}
        >
          {approving ? "Approving..." : "Approve Slides"}
        </button>
      )}

      <h2>Slide Preview</h2>
      <MarkdownPreview content={markdownContent} />
    </div>
  );
}
