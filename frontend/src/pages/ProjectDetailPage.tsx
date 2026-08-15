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
        err instanceof Error ? err.message : "スライド生成の開始に失敗しました",
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <h1>プロジェクト: {id}</h1>

      <nav style={{ marginBottom: "1rem" }}>
        <Link to={`/projects/${id}/videos`}>動画一覧</Link>
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
          <p>スライド生成を開始しました</p>
          <Link to={`/projects/${id}/versions/${result.versionNumber}`}>
            バージョン {result.versionNumber} を確認
          </Link>
        </div>
      )}

      <h2>スライド生成</h2>
      <form onSubmit={handleStartSlides}>
        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            テーマ:
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="例: AWS CDK, サーバーレス"
              style={{ marginLeft: "0.5rem", padding: "0.3rem" }}
            />
          </label>
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            対象者:
            <input
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="例: エンジニア初心者"
              style={{ marginLeft: "0.5rem", padding: "0.3rem" }}
            />
          </label>
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            持ち時間（秒）:
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="300"
              style={{ marginLeft: "0.5rem", padding: "0.3rem" }}
            />
          </label>
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            参照URL（1行に1つ）:
            <br />
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              rows={3}
              cols={50}
              placeholder="https://docs.aws.amazon.com/cdk/"
            />
          </label>
        </div>
        <button type="submit" disabled={generating}>
          {generating ? "生成中..." : "スライド生成を開始"}
        </button>
      </form>
    </div>
  );
}
