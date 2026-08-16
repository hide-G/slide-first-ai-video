import { useLanguage } from "../i18n/LanguageContext.js";
import type { CostEntry } from "../api/types.js";

export interface CostTableProps {
  entries: CostEntry[];
  totalCost: string;
}

export function CostTable({ entries, totalCost }: CostTableProps) {
  const { t } = useLanguage();

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>{t("cost.sectionTitle")}</h2>
        <span className="badge badge-ai">{t("cost.estimateBadge")}</span>
      </div>
      <p className="card-sub">{t("cost.sectionSub")}</p>

      <table className="table">
        <thead>
          <tr>
            <th>{t("cost.thStage")}</th>
            <th>{t("cost.thService")}</th>
            <th>{t("cost.thUsage")}</th>
            <th className="num">{t("cost.thEstimate")}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr key={i}>
              <td>{entry.stage}</td>
              <td>{entry.service}</td>
              <td>{entry.usage}</td>
              <td className="num">{entry.estimate}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={3}>{t("cost.total")}</th>
            <td className="num">{totalCost}</td>
          </tr>
        </tfoot>
      </table>

      <p className="note" style={{ marginTop: 16 }}>{t("cost.actualPending")}</p>
      <p className="hint">{t("cost.unitNote")}</p>
      <p className="hint">{t("cost.disclaimer")}</p>
    </div>
  );
}
