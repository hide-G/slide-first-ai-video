import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../api/client.js";
import type { Project } from "../api/types.js";

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      setLoading(true);
      const response = await apiClient.listProjects();
      setProjects(response.projects);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "プロジェクトの読み込みに失敗しました",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setCreating(true);
      setError(null);
      const response = await apiClient.createProject({ title: title.trim() });
      setProjects((prev) => [response.project, ...prev]);
      setTitle("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "プロジェクトの作成に失敗しました",
      );
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div>読み込み中...</div>;
  }

  return (
    <div>
      <h1>プロジェクト</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={handleCreateProject} style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="プロジェクト名を入力"
          disabled={creating}
          style={{ padding: "0.5rem", marginRight: "0.5rem", minWidth: "300px" }}
        />
        <button type="submit" disabled={creating || !title.trim()}>
          {creating ? "作成中..." : "プロジェクト作成"}
        </button>
      </form>

      {projects.length === 0 ? (
        <p>プロジェクトがありません。上のフォームから作成してください。</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {projects.map((project) => (
            <li
              key={project.projectId}
              style={{
                padding: "0.75rem",
                marginBottom: "0.5rem",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            >
              <Link to={`/projects/${project.projectId}`}>
                <strong>{project.title}</strong>
              </Link>
              <span
                style={{ marginLeft: "1rem", fontSize: "0.85rem", color: "#666" }}
              >
                状態: {project.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
