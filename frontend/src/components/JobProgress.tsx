import type { GetJobResponse } from "../api/types.js";
import { useLanguage } from "../i18n/LanguageContext.js";
import { jobStatusMessage } from "../i18n/messages.js";

interface JobProgressProps {
  job: GetJobResponse;
}

export function JobProgress({ job }: JobProgressProps) {
  const { format, t } = useLanguage();
  const currentJob = job.job;

  return (
    <div
      style={{
        padding: "1rem",
        border: "1px solid #ddd",
        borderRadius: "8px",
        marginBottom: "1rem",
        background: currentJob.status === "FAILED" ? "#fff0f0" : "#f0f8ff",
      }}
    >
      <p>
        <strong>{t("job.status")}:</strong> {format(jobStatusMessage(currentJob.status))}
      </p>
      {currentJob.error && (
        <p style={{ color: "red" }}>
          {t("common.error")}: {currentJob.error}
        </p>
      )}
    </div>
  );
}
