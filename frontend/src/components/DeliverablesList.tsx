import type { GetDeliverablesResponse } from "../api/types.js";

interface DeliverablesListProps {
  deliverables: GetDeliverablesResponse;
}

export function DeliverablesList({ deliverables }: DeliverablesListProps) {
  if (!deliverables.deliverables || deliverables.deliverables.length === 0) {
    return <p>成果物はまだありません。</p>;
  }

  return (
    <div>
      <h2>成果物</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {deliverables.deliverables.map((d, i) => (
          <li
            key={i}
            style={{
              padding: "0.5rem",
              borderBottom: "1px solid #eee",
            }}
          >
            <a href={d.url} target="_blank" rel="noopener noreferrer">
              📥 {d.filename}
            </a>
            <span style={{ marginLeft: "1rem", color: "#666", fontSize: "0.85rem" }}>
              ({d.type})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
