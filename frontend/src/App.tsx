import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.js";
import { useLanguage } from "./i18n/LanguageContext.js";
import { LanguageSwitcher } from "./components/LanguageSwitcher.js";
import { LoginPage } from "./pages/LoginPage.js";
import { HomePage } from "./pages/HomePage.js";
import { SlideStudioPage } from "./pages/SlideStudioPage.js";
import { VideoStudioPage } from "./pages/VideoStudioPage.js";

function ProtectedLayout() {
  const { isAuthenticated, isLoading, signOut, username } = useAuth();
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <main role="status" style={{ margin: "2rem auto", maxWidth: "900px", padding: "1rem" }}>
        {t("common.loading")}
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div>
      <header className="app-header">
        <a className="brand" href="/home" onClick={(e) => { e.preventDefault(); window.location.href = "/home"; }}>
          <span className="brand-mark" aria-hidden="true">SF</span>
          <span className="brand-text">
            <strong>Slide-First AI Video</strong>
            <span className="brand-sub">{t("common.brandSub")}</span>
          </span>
        </a>
        <div className="header-right">
          <LanguageSwitcher />
          <div className="user-menu">
            <span className="avatar" aria-hidden="true">
              {(username ?? "U").slice(0, 2).toUpperCase()}
            </span>
            <span>{username ?? "User"}</span>
            <button
              type="button"
              className="header-link"
              onClick={() => { void signOut(); }}
            >
              {t("common.logout")}
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/slide-studio" element={<SlideStudioPage />} />
          <Route path="/video-studio" element={<VideoStudioPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
