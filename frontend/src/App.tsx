import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { useAuth } from "./hooks/useAuth.js";
import { useLanguage } from "./i18n/LanguageContext.js";
import { LoginPage } from "./pages/LoginPage.js";
import { ProjectsPage } from "./pages/ProjectsPage.js";
import { ProjectDetailPage } from "./pages/ProjectDetailPage.js";
import { VersionPage } from "./pages/VersionPage.js";
import { VideosPage } from "./pages/VideosPage.js";

function ProtectedLayout() {
  const { isAuthenticated, isLoading, signOut } = useAuth();
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <main
        role="status"
        style={{ margin: "2rem auto", maxWidth: "900px", padding: "1rem" }}
      >
        {t("auth.checking")}
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout onSignOut={signOut} />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
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
