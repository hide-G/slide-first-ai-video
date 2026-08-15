import { useState, useEffect, useCallback } from "react";
import { useApi } from "../hooks/useApi";

interface DashboardProps {
  idToken: string;
  email: string;
  onSignOut: () => void;
}

type Step =
  | "idle"
  | "creating"
  | "generating_slides"
  | "polling_slides"
  | "slides_ready"
  | "approving"
  | "generating_video"
  | "polling_video"
  | "completed"
  | "error";

export function Dashboard({ idToken, email, onSignOut }: DashboardProps) {
  const api = useApi(idToken);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [deliverables, setDeliverables] = useState<
    { type: string; filename: string; url: string }[]
  >([]);
  const [progress, setProgress] = useState<string>("");

  // フォーム入力
  const [title, setTitle] = useState("AWS CDKで始めるサーバーレスアプリ");
  const [theme, setTheme] = useState("AWS CDK");
  const [audience, setAudience] = useState("AWS初心者エンジニア");
  const [duration, setDuration] = useState(5);

  // ジョブのポーリング
  const pollJob = useCallback(
    async (jid: string, nextStep: Step) => {
      const maxAttempts = 60;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        try {
          const job = await api.getJob(jid);
          setProgress(
            `${job.status}${job.progress ? ` (${job.progress}%)` : ""}`,
          );
          if (job.status === "COMPLETED" || job.status === "SUCCEEDED") {
            setStep(nextStep);
            return;
          }
          if (job.status === "FAILED") {
            setError(job.error || "ジョブが失敗しました");
            setStep("error");
            return;
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "ポーリングエラー");
          setStep("error");
          return;
        }
      }
      setError("タイムアウト: ジョブが完了しませんでした");
      setStep("error");
    },
    [api],
  );

  // 全自動実行
  const runAll = async () => {
    setError(null);
    setStep("creating");
    setDeliverables([]);
    setMarkdown(null);

    try {
      // 1. プロジェクト作成
      setProgress("プロジェクトを作成中...");
      const project = await api.createProject({
        title,
        theme: theme || undefined,
        audience: audience || undefined,
        duration: duration > 0 ? duration : undefined,
      });
      setProjectId(project.projectId);

      // 2. スライド生成
      setStep("generating_slides");
      setProgress("スライドを生成中...");
      const slideJob = await api.startSlides(project.projectId);
      setJobId(slideJob.jobId);

      // 3. ポーリング
      setStep("polling_slides");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setStep("error");
    }
  };

  // スライド生成ポーリング
  useEffect(() => {
    if (step === "polling_slides" && jobId) {
      pollJob(jobId, "slides_ready");
    }
  }, [step, jobId, pollJob]);

  // スライド完了後、自動でバージョン取得→承認→動画生成
  useEffect(() => {
    if (step !== "slides_ready" || !projectId) return;

    (async () => {
      try {
        // バージョン取得
        const version = await api.getVersion(projectId, 1);
        setMarkdown(version.markdown || null);

        // 承認
        setStep("approving");
        setProgress("スライドを承認中...");
        await api.approveVersion(projectId, 1);

        // 動画生成
        setStep("generating_video");
        setProgress("動画を生成中...");
        const videoJob = await api.startVideo(projectId, 1);
        setJobId(videoJob.jobId);

        setStep("polling_video");
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました");
        setStep("error");
      }
    })();
  }, [step, projectId, api]);

  // 動画生成ポーリング
  useEffect(() => {
    if (step === "polling_video" && jobId) {
      pollJob(jobId, "completed");
    }
  }, [step, jobId, pollJob]);

  // 完了後に成果物取得
  useEffect(() => {
    if (step !== "completed" || !projectId) return;

    (async () => {
      try {
        setProgress("成果物を取得中...");
        const result = await api.getDeliverables(projectId);
        setDeliverables(result.deliverables || []);
        setProgress("完了");
      } catch (e) {
        // 成果物取得は失敗してもエラーにしない
        setProgress("完了（成果物取得に失敗）");
      }
    })();
  }, [step, projectId, api]);

  const isRunning =
    step !== "idle" && step !== "completed" && step !== "error";

  return (
    <div className="dashboard">
      <header>
        <h1>Slide-First AI Video</h1>
        <div className="user-info">
          <span>{email}</span>
          <button onClick={onSignOut}>ログアウト</button>
        </div>
      </header>

      <main>
        <section className="create-section">
          <h2>動画プロジェクト作成</h2>
          <div className="form-grid">
            <div>
              <label>タイトル</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isRunning}
              />
            </div>
            <div>
              <label>テーマ</label>
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                disabled={isRunning}
              />
            </div>
            <div>
              <label>対象者</label>
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                disabled={isRunning}
              />
            </div>
            <div>
              <label>持ち時間（分）</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                disabled={isRunning}
              />
            </div>
          </div>
          <button
            className="primary-button"
            onClick={runAll}
            disabled={isRunning || !title}
          >
            {isRunning ? "実行中..." : "スライド生成 → 動画生成（全自動）"}
          </button>
        </section>

        {/* 進捗表示 */}
        {step !== "idle" && (
          <section className="progress-section">
            <h2>進捗</h2>
            <div className="progress-bar">
              <div className={`step ${step === "error" ? "error" : ""}`}>
                {progress}
              </div>
            </div>
            {error && <p className="error">{error}</p>}
          </section>
        )}

        {/* スライドプレビュー */}
        {markdown && (
          <section className="preview-section">
            <h2>生成されたスライド (Marp Markdown)</h2>
            <pre className="markdown-preview">{markdown}</pre>
          </section>
        )}

        {/* 成果物 */}
        {deliverables.length > 0 && (
          <section className="deliverables-section">
            <h2>成果物</h2>
            <ul>
              {deliverables.map((d, i) => (
                <li key={i}>
                  <a href={d.url} target="_blank" rel="noopener noreferrer">
                    {d.filename} ({d.type})
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
