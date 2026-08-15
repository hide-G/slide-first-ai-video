import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../api/client.js";
import type { Project } from "../api/types.js";
import { getErrorDescriptor } from "../i18n/errors.js";
import { useLanguage } from "../i18n/LanguageContext.js";
import {
  message,
  statusMessage,
  type MessageDescriptor,
} from "../i18n/messages.js";

export function ProjectsPage() {
  const { format, t } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<MessageDescriptor | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void loadProjects();
  }, []);

  async function loadProjects(): Promise<void> {
    try {
      setLoading(true);
      const response = await apiClient.listProjects();
      setProjects(response.projects);
    } catch (error) {
      setError(getErrorDescriptor(error, message("errors.projectsLoad")));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProject(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!title.trim()) {
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const response = await apiClient.createProject({ title: title.trim() });
      setProjects((previousProjects) => [
        response.project,
        ...previousProjects,
      ]);
      setTitle("");
    } catch (error) {
      setError(getErrorDescriptor(error, message("errors.projectsCreate")));
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div>{t("common.loading")}</div>;
  }

  return (
    <div>
      <h1>{t("projects.title")}</h1>

      {error && <p role="alert" style={{ color: "red" }}>{format(error)}</p>}

      <form onSubmit={handleCreateProject} style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("projects.namePlaceholder")}
          disabled={creating}
          style={{ padding: "0.5rem", marginRight: "0.5rem", minWidth: "300px" }}
        />
        <button type="submit" disabled={creating || !title.trim()}>
          {creating ? t("projects.creating") : t("projects.create")}
        </button>
      </form>

      {projects.length === 0 ? (
        <p>{t("projects.empty")}</p>
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
                {t("common.status")}: {format(statusMessage(project.status))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
