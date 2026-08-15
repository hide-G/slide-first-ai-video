import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiClient } from "../api/client.js";
import { getErrorDescriptor } from "../i18n/errors.js";
import { useLanguage } from "../i18n/LanguageContext.js";
import { message, type MessageDescriptor } from "../i18n/messages.js";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { format, t } = useLanguage();
  const [theme, setTheme] = useState("");
  const [audience, setAudience] = useState("");
  const [duration, setDuration] = useState("");
  const [urls, setUrls] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<MessageDescriptor | null>(null);
  const [result, setResult] = useState<{
    jobId: string;
    versionNumber: number;
  } | null>(null);

  async function handleStartSlides(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!id) {
      return;
    }

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
              .map((url) => url.trim())
              .filter(Boolean)
          : undefined,
      });
      setResult({
        jobId: response.jobId,
        versionNumber: response.versionNumber,
      });
    } catch (error) {
      setError(getErrorDescriptor(error, message("errors.slidesStart")));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <h1>{t("project.detailTitle", { id: id ?? "" })}</h1>

      <nav style={{ marginBottom: "1rem" }}>
        <Link to={`/projects/${id}/videos`}>{t("project.videos")}</Link>
      </nav>

      {error && (
        <div role="alert" style={{ color: "red", marginBottom: "1rem" }}>
          {format(error)}
        </div>
      )}

      {result && (
        <div
          style={{
            background: "#e6ffe6",
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "1rem",
          }}
        >
          <p>{t("project.slidesStarted")}</p>
          <Link to={`/projects/${id}/versions/${result.versionNumber}`}>
            {t("project.viewVersion", { version: result.versionNumber })}
          </Link>
        </div>
      )}

      <h2>{t("project.slides")}</h2>
      <form onSubmit={handleStartSlides}>
        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            {t("project.theme")}
            <input
              type="text"
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
              placeholder={t("project.themePlaceholder")}
              style={{ marginLeft: "0.5rem", padding: "0.3rem" }}
            />
          </label>
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            {t("project.audience")}
            <input
              type="text"
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              placeholder={t("project.audiencePlaceholder")}
              style={{ marginLeft: "0.5rem", padding: "0.3rem" }}
            />
          </label>
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            {t("project.duration")}
            <input
              type="number"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              placeholder="300"
              style={{ marginLeft: "0.5rem", padding: "0.3rem" }}
            />
          </label>
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            {t("project.references")}
            <br />
            <textarea
              value={urls}
              onChange={(event) => setUrls(event.target.value)}
              rows={3}
              cols={50}
              placeholder="https://docs.aws.amazon.com/cdk/"
            />
          </label>
        </div>
        <button type="submit" disabled={generating}>
          {generating ? t("project.generating") : t("project.startSlides")}
        </button>
      </form>
    </div>
  );
}
