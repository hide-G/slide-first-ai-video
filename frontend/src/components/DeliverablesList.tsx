import { useState, useEffect } from "react";
import { apiClient } from "../api/client.js";
import type { Deliverable } from "../api/types.js";

interface DeliverablesListProps {
  projectId: string;
  onVideoSelect?: (url: string) => void;
}

/**
 * Fetch and display downloadable deliverables (PDF, PPTX, MP4, VTT, SRT).
 */
export function DeliverablesList({
  projectId,
  onVideoSelect,
}: DeliverablesListProps) {
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDeliverables();
  }, [projectId]);

  async function loadDeliverables() {
    try {
      setLoading(true);
      const response = await apiClient.getDeliverables(projectId);
      setDeliverables(response.deliverables);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load deliverables",
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div>Loading deliverables...</div>;
  }

  if (error) {
    return <div style={{ color: "red" }}>{error}</div>;
  }

  if (deliverables.length === 0) {
    return <p>No deliverables available yet.</p>;
  }

  return (
    <div>
      <h2>Deliverables</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {deliverables.map((d) => (
          <li
            key={d.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "0.5rem",
              border: "1px solid #eee",
              borderRadius: "4px",
              marginBottom: "0.5rem",
            }}
          >
            <span style={{ fontWeight: "bold", textTransform: "uppercase" }}>
              {d.type}
            </span>
            <span style={{ flex: 1 }}>{d.filename}</span>
            <a
              href={d.url}
              download={d.filename}
              style={{ color: "#2196F3" }}
            >
              Download
            </a>
            {d.type === "mp4" && onVideoSelect && (
              <button
                onClick={() => onVideoSelect(d.url)}
                style={{
                  background: "none",
                  border: "1px solid #2196F3",
                  color: "#2196F3",
                  borderRadius: "4px",
                  padding: "0.25rem 0.5rem",
                  cursor: "pointer",
                }}
              >
                Play
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
