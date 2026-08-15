import type { GetDeliverablesResponse } from "../api/types.js";
import { useLanguage } from "../i18n/LanguageContext.js";

interface DeliverablesListProps {
  deliverables: GetDeliverablesResponse;
}

export function DeliverablesList({ deliverables }: DeliverablesListProps) {
  const { t } = useLanguage();

  if (!deliverables.deliverables || deliverables.deliverables.length === 0) {
    return <p>{t("deliverables.empty")}</p>;
  }

  return (
    <div>
      <h2>{t("deliverables.title")}</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {deliverables.deliverables.map((deliverable) => (
          <li
            key={deliverable.key}
            style={{
              padding: "0.5rem",
              borderBottom: "1px solid #eee",
            }}
          >
            <a
              href={deliverable.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("deliverables.download", {
                filename: deliverable.filename,
              })}
            >
              📥 {deliverable.filename}
            </a>
            <span style={{ marginLeft: "1rem", color: "#666", fontSize: "0.85rem" }}>
              ({t("deliverables.type", { type: deliverable.type })})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
