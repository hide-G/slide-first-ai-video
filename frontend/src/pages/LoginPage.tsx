import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "../components/LanguageSwitcher.js";
import { useLanguage } from "../i18n/LanguageContext.js";
import type { MessageKey } from "../i18n/messages.js";
import { useAuth } from "../hooks/useAuth.js";

/** ログイン画面が取り得る表示モード。 */
type Mode = "signIn" | "forgot" | "forgotConfirm" | "signUp" | "signUpConfirm";

/**
 * Amplify/Cognito の例外を、利用者向けの i18n メッセージキーに変換する。
 * 例外の name（Cognito のエラー種別）を優先し、未知のものは汎用メッセージにする。
 */
function toErrorMessageKey(err: unknown): MessageKey {
  const name = err instanceof Error ? err.name : "";
  switch (name) {
    case "NotAuthorizedException":
      return "login.errIncorrect";
    case "UserNotFoundException":
      return "login.errUserNotFound";
    case "CodeMismatchException":
      return "login.errCodeMismatch";
    case "ExpiredCodeException":
      return "login.errCodeExpired";
    case "InvalidPasswordException":
      return "login.errInvalidPassword";
    case "UsernameExistsException":
      return "login.errUserExists";
    case "LimitExceededException":
    case "TooManyRequestsException":
      return "login.errLimitExceeded";
    case "UserNotConfirmedException":
      return "login.errNotConfirmed";
    default:
      return "login.errGeneric";
  }
}

export function LoginPage() {
  const { t } = useLanguage();
  const {
    signIn,
    requestPasswordReset,
    confirmPasswordReset,
    signUp,
    confirmSignUp,
    resendSignUpCode,
  } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** モードを切り替え、入力途中のコード類と通知をリセットする。 */
  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
    setCode("");
    setNewPassword("");
  }

  /** 非同期処理を共通のローディング・エラー制御でラップする。 */
  async function run(action: () => Promise<void>) {
    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      await action();
    } catch (err) {
      setError(t(toErrorMessageKey(err)));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      await signIn(email, password);
      navigate("/home", { replace: true });
    });
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      await requestPasswordReset(email);
      setMode("forgotConfirm");
    });
  }

  async function handleForgotConfirm(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      await confirmPasswordReset(email, code, newPassword);
      switchMode("signIn");
      setNotice(t("login.resetDone"));
    });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      await signUp(email, password);
      setMode("signUpConfirm");
    });
  }

  async function handleSignUpConfirm(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      await confirmSignUp(email, code);
      switchMode("signIn");
      setNotice(t("login.signupDone"));
    });
  }

  async function handleResend() {
    await run(async () => {
      await resendSignUpCode(email);
      setNotice(t("login.resendDone"));
    });
  }

  const showPasswordToggle = (
    <label className="checkbox-row" style={{ marginTop: 8 }}>
      <input
        type="checkbox"
        checked={showPassword}
        onChange={(e) => setShowPassword(e.target.checked)}
      />
      <span>{t("login.showPassword")}</span>
    </label>
  );

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
          {error && <p role="alert" style={{ color: "red" }}>{error}</p>}
          {notice && <p role="status" style={{ color: "green" }}>{notice}</p>}

          {mode === "signIn" && (
            <>
              <h2>{t("login.formTitle")}</h2>
              <p className="card-sub">{t("login.formSub")}</p>
              <form onSubmit={(e) => { void handleSignIn(e); }}>
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
                  {showPasswordToggle}
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-block"
                  disabled={isSubmitting}
                >
                  {t("login.submit")}
                </button>
              </form>

              <div className="login-links">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => switchMode("forgot")}
                >
                  {t("login.forgot")}
                </button>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => switchMode("signUp")}
                >
                  {t("login.signup")}
                </button>
              </div>
            </>
          )}

          {mode === "forgot" && (
            <>
              <h2>{t("login.resetTitle")}</h2>
              <p className="card-sub">{t("login.resetSub")}</p>
              <form onSubmit={(e) => { void handleForgot(e); }}>
                <div className="field">
                  <label htmlFor="reset-email">{t("login.email")}</label>
                  <input
                    type="email"
                    id="reset-email"
                    name="email"
                    autoComplete="username"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-block"
                  disabled={isSubmitting}
                >
                  {t("login.resetSend")}
                </button>
              </form>
              <div className="login-links">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => switchMode("signIn")}
                >
                  {t("login.backToSignIn")}
                </button>
              </div>
            </>
          )}

          {mode === "forgotConfirm" && (
            <>
              <h2>{t("login.resetConfirmTitle")}</h2>
              <p className="card-sub">{t("login.resetConfirmSub")}</p>
              <form onSubmit={(e) => { void handleForgotConfirm(e); }}>
                <div className="field">
                  <label htmlFor="reset-code">{t("login.code")}</label>
                  <input
                    type="text"
                    id="reset-code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="reset-new-password">{t("login.newPassword")}</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="reset-new-password"
                    name="new-password"
                    autoComplete="new-password"
                    placeholder="********"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  {showPasswordToggle}
                  <p className="card-sub" style={{ marginTop: 4 }}>{t("login.passwordHint")}</p>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-block"
                  disabled={isSubmitting}
                >
                  {t("login.resetConfirm")}
                </button>
              </form>
              <div className="login-links">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => switchMode("signIn")}
                >
                  {t("login.backToSignIn")}
                </button>
              </div>
            </>
          )}

          {mode === "signUp" && (
            <>
              <h2>{t("login.signupTitle")}</h2>
              <p className="card-sub">{t("login.signupSub")}</p>
              <form onSubmit={(e) => { void handleSignUp(e); }}>
                <div className="field">
                  <label htmlFor="signup-email">{t("login.email")}</label>
                  <input
                    type="email"
                    id="signup-email"
                    name="email"
                    autoComplete="username"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="signup-password">{t("login.password")}</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="signup-password"
                    name="new-password"
                    autoComplete="new-password"
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  {showPasswordToggle}
                  <p className="card-sub" style={{ marginTop: 4 }}>{t("login.passwordHint")}</p>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-block"
                  disabled={isSubmitting}
                >
                  {t("login.signupSubmit")}
                </button>
              </form>
              <div className="login-links">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => switchMode("signIn")}
                >
                  {t("login.backToSignIn")}
                </button>
              </div>
            </>
          )}

          {mode === "signUpConfirm" && (
            <>
              <h2>{t("login.signupConfirmTitle")}</h2>
              <p className="card-sub">{t("login.signupConfirmSub")}</p>
              <form onSubmit={(e) => { void handleSignUpConfirm(e); }}>
                <div className="field">
                  <label htmlFor="signup-code">{t("login.code")}</label>
                  <input
                    type="text"
                    id="signup-code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-block"
                  disabled={isSubmitting}
                >
                  {t("login.signupConfirm")}
                </button>
              </form>
              <div className="login-links">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => { void handleResend(); }}
                  disabled={isSubmitting}
                >
                  {t("login.resendCode")}
                </button>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => switchMode("signIn")}
                >
                  {t("login.backToSignIn")}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
