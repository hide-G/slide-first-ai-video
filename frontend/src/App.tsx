import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { LoginPage } from "./pages/LoginPage.js";
import { ProjectsPage } from "./pages/ProjectsPage.js";
import { ProjectDetailPage } from "./pages/ProjectDetailPage.js";
import { VersionPage } from "./pages/VersionPage.js";
import { VideosPage } from "./pages/VideosPage.js";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Layout />}>
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route
            path="/projects/:id/versions/:version"
            element={<VersionPage />}
          />
          <Route path="/projects/:id/videos" element={<VideosPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/projects" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
