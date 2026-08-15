import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { apiClient } from "../api/client.js";
import { MarkdownPreview } from "../components/MarkdownPreview.js";
import type { GetVersionResponse } from "../api/types.js";
import { getErrorDescriptor } from "../i18n/errors.js";
import { useLanguage } from "../i18n/LanguageContext.js";
import {
  message,
  statusMessage,
  type MessageDescriptor,
} from "../i18n/messages.js";

export function VersionPage() {
  const { id, version } = useParams<{ id: string; version: string }>();
  const { format, t } = useLanguage();
  const [data, setData] = useState<GetVersionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<MessageDescriptor | null>(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (!id || !version) {
      return;
    }

    void loadVersion();
  }, [id, version]);

  async function loadVersion(): Promise<void> {
    try {
      setLoading(true);
      const response = await apiClient.getVersion(id!, Number(version));
      setData(response);
    } catch (error) {
      setError(getErrorDescriptor(error, message("errors.versionLoad")));
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(): Promise<void> {
    if (!id || !version) {
      return;
    }

    try {
      setApproving(true);
      setError(null);
      await apiClient.approveVersion(id, Number(version));
      await loadVersion();
    } catch (error) {
      setError(getErrorDescriptor(error, message("errors.versionApprove")));
    } finally {
      setApproving(false);
    }
  }

  if (loading) {
    return <div>{t("common.loading")}</div>;
  }

  if (error) {
    return <div role="alert" style={{ color: "red" }}>{format(error)}</div>;
  }

  if (!data) {
    return <div>{t("version.notFound")}</div>;
  }

  return (
    <div>
      <h1>{t("version.title", { version: version ?? "" })}</h1>
      <p>
        {t("common.status")}: {" "}
        <strong>{format(statusMessage(data.version.status))}</strong>
      </p>

      {data.version.status === "SLIDE_READY" && (
        <button onClick={() => void handleApprove()} disabled={approving}>
          {approving ? t("version.approving") : t("version.approve")}
        </button>
      )}

      {data.version.status === "SLIDE_APPROVED" && (
        <p style={{ color: "green" }}>{t("version.approved")}</p>
      )}

      {data.markdownContent && (
        <div style={{ marginTop: "1rem" }}>
          <h2>{t("version.slidesMarkdown")}</h2>
          <MarkdownPreview content={data.markdownContent} />
        </div>
      )}

      <div style={{ marginTop: "1rem" }}>
        <Link to={`/projects/${id}`}>{t("nav.backToProject")}</Link>
      </div>
    </div>
  );
}
