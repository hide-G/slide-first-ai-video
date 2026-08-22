import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext.js";
import { apiClient } from "../api/client.js";
import type { Project, RenderSummary } from "../api/types.js";

function isVideoProject(project: Project): boolean {
  return project.kind !== "slide";
}

function renderStatusLabel(render: RenderSummary | undefined): string | null {
  if (!render) return null;
  if (render.status === "COMPLETED") return "完了";
  if (render.status === "FAILED") return "失敗";
  return "処理中";
}

function renderStatusClass(render: RenderSummary | undefined): string {
  if (!render) return "badge badge-draft";
  if (render.status === "COMPLETED") return "badge badge-done";
  if (render.status === "FAILED") return "badge badge-failed";
  return "badge badge-run";
}

function renderProgressText(render: RenderSummary | undefined): string | null {
  if (!render || render.status !== "RUNNING") return null;

  const pageText =
    typeof render.currentPage === "number" && typeof render.totalPages === "number"
      ? `ページ ${render.currentPage}/${render.totalPages}`
      : null;
  return [render.progressMessage, pageText].filter(Boolean).join(" / ") || "処理を開始しています。";
}

export function HomePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadingRenderId, setDownloadingRenderId] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const res = await apiClient.listProjects();
      const hydratedProjects = await Promise.all(
        res.projects.map(async (project) => {
          const latestRender = project.latestRender;
          if (!latestRender || latestRender.status !== "RUNNING") return project;

          try {
            const render = await apiClient.getRender(project.projectId, latestRender.renderId);
            return { ...project, latestRender: render };
          } catch {
            // 一時的に進捗を取得できなくても、一覧の最後に保存された状態を表示する。
            return project;
          }
        }),
      );
      setProjects(hydratedProjects);
      setErrorMessage(null);
    } catch {
      setErrorMessage(
        "プロジェクト一覧を取得できませんでした。時間をおいて再読み込みしてください。",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
    const timer = window.setInterval(() => {
      void loadProjects();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadProjects]);

  async function handleDownload(project: Project, render: RenderSummary) {
    setDownloadingRenderId(render.renderId);
    setErrorMessage(null);
    try {
      const result = await apiClient.getArtifacts(project.projectId, render.renderId);
      const video = result.artifacts.find((artifact) =>
        artifact.key.toLowerCase().endsWith(".mp4"),
      );
      if (!video) {
        throw new Error("MP4成果物が見つかりません。");
      }
      window.location.assign(video.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "不明なエラー";
      setErrorMessage(`動画をダウンロードできません: ${message}`);
    } finally {
      setDownloadingRenderId(null);
    }
  }

  function openProject(project: Project) {
    const render = project.latestRender;
    if (isVideoProject(project)) {
      const params = new URLSearchParams({ projectId: project.projectId });
      if (render) params.set("renderId", render.renderId);
      navigate(`/video-studio?${params.toString()}`);
      return;
    }
    navigate("/slide-studio");
  }

  function getStatusBadgeClass(status: string): string {
    switch (status.toLowerCase()) {
      case "done":
      case "completed":
        return "badge badge-done";
      case "running":
      case "rendering":
        return "badge badge-run";
      case "draft":
        return "badge badge-draft";
      default:
        return "badge";
    }
  }

  function getStatusLabel(status: string): string {
    switch (status.toLowerCase()) {
      case "done":
      case "completed":
        return t("home.stateDone");
      case "running":
      case "rendering":
        return t("home.stateRunning");
      case "draft":
        return t("home.stateDraft");
      default:
        return status;
    }
  }

  return (
    <main className="page">
      <div className="page-head">
        <h1>{t("home.heading")}</h1>
        <p>{t("home.lead")}</p>
      </div>

      {errorMessage && (
        <p className="note note-warn" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="entry-grid" style={{ marginBottom: 24 }}>
        <section className="entry-card">
          <span className="kicker">{t("home.card1Kicker")}</span>
          <h2>{t("home.card1Title")}</h2>
          <p>{t("home.card1Body")}</p>
          <ul>
            <li>{t("home.card1Point1")}</li>
            <li>{t("home.card1Point2")}</li>
            <li>{t("home.card1Point3")}</li>
          </ul>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate("/slide-studio")}
          >
            {t("home.card1Cta")}
          </button>
        </section>

        <section className="entry-card">
          <span className="kicker">{t("home.card2Kicker")}</span>
          <h2>{t("home.card2Title")}</h2>
          <p>{t("home.card2Body")}</p>
          <ul>
            <li>{t("home.card2Point1")}</li>
            <li>{t("home.card2Point2")}</li>
            <li>{t("home.card2Point3")}</li>
          </ul>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate("/video-studio")}
          >
            {t("home.card2Cta")}
          </button>
        </section>
      </div>

      <section className="card">
        <h2>{t("home.recentTitle")}</h2>
        <p className="card-sub">{t("home.recentSub")}</p>
        {loading ? (
          <p>{t("common.loading")}</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("home.thName")}</th>
                <th>{t("home.thKind")}</th>
                <th>{t("home.thSize")}</th>
                <th>{t("home.thUpdated")}</th>
                <th className="num">{t("cost.recentCost")}</th>
                <th>{t("home.thState")}</th>
                <th>
                  <span className="visually-hidden">{t("home.thAction")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const render = project.latestRender;
                const renderLabel = renderStatusLabel(render);
                const progressText = renderProgressText(render);
                return (
                  <tr key={project.projectId}>
                    <td>{project.title}</td>
                    <td>{isVideoProject(project) ? t("home.kindVideo") : t("home.kindSlide")}</td>
                    <td>{project.output ?? "-"}</td>
                    <td>{project.updatedAt.split("T")[0]}</td>
                    <td className="num">
                      {project.estimatedCost != null
                        ? `${project.estimatedCost.toFixed(4)} USD`
                        : "-"}
                    </td>
                    <td>
                      {renderLabel ? (
                        <>
                          <span className={renderStatusClass(render)}>{renderLabel}</span>
                          {progressText && (
                            <p className="hint" style={{ margin: "4px 0 0" }}>
                              {progressText}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className={getStatusBadgeClass(project.status)}>
                          {getStatusLabel(project.status)}
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => openProject(project)}
                        >
                          {render ? "進捗を開く" : t("common.open")}
                        </button>
                        {isVideoProject(project) && render?.status === "COMPLETED" && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={downloadingRenderId === render.renderId}
                            onClick={() => {
                              void handleDownload(project, render);
                            }}
                          >
                            {downloadingRenderId === render.renderId
                              ? "URLを準備中..."
                              : "MP4をダウンロード"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!projects.length && (
                <tr>
                  <td colSpan={7} className="hint">
                    まだプロジェクトはありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
