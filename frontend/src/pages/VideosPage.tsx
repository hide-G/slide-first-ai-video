import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiClient } from "../api/client.js";
import { JobProgress } from "../components/JobProgress.js";
import { DeliverablesList } from "../components/DeliverablesList.js";
import type { Job, GetDeliverablesResponse } from "../api/types.js";
import { getErrorDescriptor } from "../i18n/errors.js";
import { useLanguage } from "../i18n/LanguageContext.js";
import { message, type MessageDescriptor } from "../i18n/messages.js";

export function VideosPage() {
  const { id } = useParams<{ id: string }>();
  const { format, t } = useLanguage();
  const [versionNumber, setVersionNumber] = useState("1");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<MessageDescriptor | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [deliverables, setDeliverables] =
    useState<GetDeliverablesResponse | null>(null);

  async function handleStartVideo(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!id) {
      return;
    }

    try {
      setGenerating(true);
      setError(null);
      const response = await apiClient.startVideo(id, {
        versionNumber: Number(versionNumber),
      });
      void pollJob(response.jobId);
    } catch (error) {
      setError(getErrorDescriptor(error, message("errors.videosStart")));
      setGenerating(false);
    }
  }

  async function pollJob(jobId: string): Promise<void> {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      try {
        const jobData = await apiClient.getJob(jobId);
        setJob(jobData.job);
        if (jobData.job.status === "SUCCEEDED") {
          setGenerating(false);
          const nextDeliverables = await apiClient.getDeliverables(id!);
          setDeliverables(nextDeliverables);
          return;
        }
        if (jobData.job.status === "FAILED") {
          setError(message("errors.videosGeneration"));
          setGenerating(false);
          return;
        }
      } catch (error) {
        setError(getErrorDescriptor(error, message("errors.videosStatusCheck")));
        setGenerating(false);
        return;
      }
    }

    setError(message("errors.videosTimeout"));
    setGenerating(false);
  }

  return (
    <div>
      <h1>{t("videos.title")}</h1>

      {error && (
        <div role="alert" style={{ color: "red", marginBottom: "1rem" }}>
          {format(error)}
        </div>
      )}

      <form onSubmit={handleStartVideo} style={{ marginBottom: "1rem" }}>
        <label>
          {t("videos.versionNumber")}
          <input
            type="number"
            value={versionNumber}
            onChange={(event) => setVersionNumber(event.target.value)}
            min="1"
            style={{ marginLeft: "0.5rem", padding: "0.3rem", width: "80px" }}
          />
        </label>
        <button
          type="submit"
          disabled={generating}
          style={{ marginLeft: "1rem" }}
        >
          {generating ? t("videos.generating") : t("videos.start")}
        </button>
      </form>

      {job && <JobProgress job={{ job }} />}

      {deliverables && <DeliverablesList deliverables={deliverables} />}

      <div style={{ marginTop: "1rem" }}>
        <Link to={`/projects/${id}`}>{t("nav.backToProject")}</Link>
      </div>
    </div>
  );
}
