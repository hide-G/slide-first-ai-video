import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "../components/LanguageSwitcher.js";
import { useLanguage } from "../i18n/LanguageContext.js";
import { useAuth } from "../hooks/useAuth.js";

export function LoginPage() {
  const { t } = useLanguage();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      navigate("/home", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSso() {
    // Navigate to Cognito hosted UI - in real impl this would be configured
    window.location.href = "/home";
  }

  function handleForgot() {
    // Placeholder action for forgot password
    window.alert("Password reset flow would open here.");
  }

  function handleSignup() {
    // Placeholder action for sign up
    window.alert("Sign up flow would open here.");
  }

  return (
    <div>
      <header className="app-header">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true">SF</span>
          <span className="brand-text">
            <strong>Slide-First AI Video</strong>
            <span className="brand-sub">{t("common.brandSub")}</span>
          </span>
        </span>
        <div className="header-right">
          <LanguageSwitcher />
        </div>
      </header>

      <main className="login-layout">
        <div className="login-pitch">
          <h1>{t("login.heading")}</h1>
          <p>{t("login.lead")}</p>
          <ul className="pitch-list">
            <li>{t("login.point1")}</li>
            <li>{t("login.point2")}</li>
            <li>{t("login.point3")}</li>
          </ul>
        </div>

        <div className="card">
          <h2>{t("login.formTitle")}</h2>
          <p className="card-sub">{t("login.formSub")}</p>

          {error && <p role="alert" style={{ color: "red" }}>{error}</p>}

          <form onSubmit={(e) => { void handleSubmit(e); }}>
            <div className="field">
              <label htmlFor="email">{t("login.email")}</label>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="username"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="password">{t("login.password")}</label>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                autoComplete="current-password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <label className="checkbox-row" style={{ marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                <span>{t("login.showPassword")}</span>
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={isSubmitting}
            >
              {t("login.submit")}
            </button>
          </form>

          <p className="divider">{t("common.or")}</p>

          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={handleSso}
          >
            {t("login.sso")}
          </button>

          <div className="login-links">
            <button type="button" className="link-btn" onClick={handleForgot}>
              {t("login.forgot")}
            </button>
            <button type="button" className="link-btn" onClick={handleSignup}>
              {t("login.signup")}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
