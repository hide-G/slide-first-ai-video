import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiClient } from "../api/client.js";
import { JobProgress } from "../components/JobProgress.js";
import { DeliverablesList } from "../components/DeliverablesList.js";
import type { Job, GetDeliverablesResponse } from "../api/types.js";

export function VideosPage() {
  const { id } = useParams<{ id: string }>();
  const [versionNumber, setVersionNumber] = useState("1");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [deliverables, setDeliverables] =
    useState<GetDeliverablesResponse | null>(null);

  async function handleStartVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;

    try {
      setGenerating(true);
      setError(null);
      const response = await apiClient.startVideo(id, {
        versionNumber: Number(versionNumber),
      });
      pollJob(response.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "動画生成の開始に失敗しました");
      setGenerating(false);
    }
  }

  async function pollJob(jobId: string) {
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const jobData = await apiClient.getJob(jobId);
        setJob(jobData.job);
        if (jobData.job.status === "SUCCEEDED") {
          setGenerating(false);
          const delivs = await apiClient.getDeliverables(id!);
          setDeliverables(delivs);
          return;
        }
        if (jobData.job.status === "FAILED") {
          setError(jobData.job.error || "動画生成に失敗しました");
          setGenerating(false);
          return;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "状態確認に失敗しました");
        setGenerating(false);
        return;
      }
    }
    setError("タイムアウト: 動画生成が完了しませんでした");
    setGenerating(false);
  }

  return (
    <div>
      <h1>動画生成</h1>

      {error && <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>}

      <form onSubmit={handleStartVideo} style={{ marginBottom: "1rem" }}>
        <label>
          バージョン番号:
          <input
            type="number"
            value={versionNumber}
            onChange={(e) => setVersionNumber(e.target.value)}
            min="1"
            style={{ marginLeft: "0.5rem", padding: "0.3rem", width: "80px" }}
          />
        </label>
        <button
          type="submit"
          disabled={generating}
          style={{ marginLeft: "1rem" }}
        >
          {generating ? "生成中..." : "動画生成を開始"}
        </button>
      </form>

      {job && <JobProgress job={{ job }} />}

      {deliverables && <DeliverablesList deliverables={deliverables} />}

      <div style={{ marginTop: "1rem" }}>
        <Link to={`/projects/${id}`}>← プロジェクトに戻る</Link>
      </div>
    </div>
  );
}
