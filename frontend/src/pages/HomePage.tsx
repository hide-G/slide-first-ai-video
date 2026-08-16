import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext.js";
import { apiClient } from "../api/client.js";
import type { Project } from "../api/types.js";

export function HomePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const res = await apiClient.listProjects();
      setProjects(res.projects);
    } catch {
      // Silently handle - projects will be empty
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case "done": return "badge badge-done";
      case "running": return "badge badge-run";
      case "draft": return "badge badge-draft";
      default: return "badge";
    }
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case "done": return t("home.stateDone");
      case "running": return t("home.stateRunning");
      case "draft": return t("home.stateDraft");
      default: return status;
    }
  }

  return (
    <main className="page">
      <div className="page-head">
        <h1>{t("home.heading")}</h1>
        <p>{t("home.lead")}</p>
      </div>

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
                <th><span className="visually-hidden">{t("home.thAction")}</span></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.projectId}>
                  <td>{project.title}</td>
                  <td>{project.kind === "video" ? t("home.kindVideo") : t("home.kindSlide")}</td>
                  <td>{project.output ?? "-"}</td>
                  <td>{project.updatedAt.split("T")[0]}</td>
                  <td className="num">
                    {project.estimatedCost != null ? `${project.estimatedCost.toFixed(4)} USD` : "-"}
                  </td>
                  <td>
                    <span className={getStatusBadgeClass(project.status)}>
                      {getStatusLabel(project.status)}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => navigate(project.kind === "video" ? "/video-studio" : "/slide-studio")}
                    >
                      {t("common.open")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
