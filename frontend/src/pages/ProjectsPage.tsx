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
      setError(err instanceof Error ? err.message : "Failed to load projects");
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
        err instanceof Error ? err.message : "Failed to create project",
      );
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div>Loading projects...</div>;
  }

  return (
    <div>
      <h1>Projects</h1>

      {error && <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>}

      <form onSubmit={handleCreateProject} style={{ marginBottom: "2rem" }}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Project title"
          required
          style={{ marginRight: "0.5rem", padding: "0.5rem" }}
        />
        <button type="submit" disabled={creating}>
          {creating ? "Creating..." : "Create Project"}
        </button>
      </form>

      {projects.length === 0 ? (
        <p>No projects yet. Create one above.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {projects.map((project) => (
            <li
              key={project.projectId}
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "1rem",
                marginBottom: "0.5rem",
              }}
            >
              <Link to={`/projects/${project.projectId}`}>
                <strong>{project.title}</strong>
              </Link>
              {project.description && <p>{project.description}</p>}
              <small>Created: {new Date(project.createdAt).toLocaleDateString()}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
