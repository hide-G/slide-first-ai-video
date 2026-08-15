import type { GetJobResponse } from "../api/types.js";

interface JobProgressProps {
  job: GetJobResponse;
}

const statusLabel: Record<string, string> = {
  PENDING: "待機中",
  RUNNING: "実行中",
  SUCCEEDED: "完了",
  FAILED: "失敗",
  CANCELLED: "キャンセル",
};

export function JobProgress({ job }: JobProgressProps) {
  const j = job.job;
  return (
    <div
      style={{
        padding: "1rem",
        border: "1px solid #ddd",
        borderRadius: "8px",
        marginBottom: "1rem",
        background: j.status === "FAILED" ? "#fff0f0" : "#f0f8ff",
      }}
    >
      <p>
        <strong>ジョブ状態:</strong> {statusLabel[j.status] || j.status}
      </p>
      {j.error && <p style={{ color: "red" }}>エラー: {j.error}</p>}
    </div>
  );
}
