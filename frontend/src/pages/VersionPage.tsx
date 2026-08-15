import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { apiClient } from "../api/client.js";
import { JobProgress } from "../components/JobProgress.js";
import { MarkdownPreview } from "../components/MarkdownPreview.js";
import type { GetVersionResponse } from "../api/types.js";

export function VersionPage() {
  const { id, version } = useParams<{ id: string; version: string }>();
  const [data, setData] = useState<GetVersionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (!id || !version) return;
    loadVersion();
  }, [id, version]);

  async function loadVersion() {
    try {
      setLoading(true);
      const response = await apiClient.getVersion(id!, Number(version));
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!id || !version) return;
    try {
      setApproving(true);
      await apiClient.approveVersion(id, Number(version));
      await loadVersion();
    } catch (err) {
      setError(err instanceof Error ? err.message : "承認に失敗しました");
    } finally {
      setApproving(false);
    }
  }

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (!data) return <div>データが見つかりません</div>;

  return (
    <div>
      <h1>バージョン {version}</h1>
      <p>状態: <strong>{data.version.status}</strong></p>

      {data.version.status === "SLIDE_READY" && (
        <button onClick={handleApprove} disabled={approving}>
          {approving ? "承認中..." : "このバージョンを承認する"}
        </button>
      )}

      {data.version.status === "SLIDE_APPROVED" && (
        <p style={{ color: "green" }}>✅ 承認済み — 動画生成が可能です</p>
      )}

      {data.markdownContent && (
        <div style={{ marginTop: "1rem" }}>
          <h2>スライド (Marp Markdown)</h2>
          <MarkdownPreview content={data.markdownContent} />
        </div>
      )}

      <div style={{ marginTop: "1rem" }}>
        <Link to={`/projects/${id}`}>← プロジェクトに戻る</Link>
      </div>
    </div>
  );
}
