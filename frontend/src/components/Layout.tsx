import { useRef, useState } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { getErrorDescriptor } from "../i18n/errors.js";
import { useLanguage } from "../i18n/LanguageContext.js";
import { message, type MessageDescriptor } from "../i18n/messages.js";
import { LanguageSwitcher } from "./LanguageSwitcher.js";

export interface LayoutProps {
  onSignOut: () => Promise<void>;
}

export function Layout({ onSignOut }: LayoutProps) {
  const navigate = useNavigate();
  const { format, t } = useLanguage();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<MessageDescriptor | null>(null);
  const isSigningOutRef = useRef(false);

  async function handleSignOut(): Promise<void> {
    if (isSigningOutRef.current) {
      return;
    }

    isSigningOutRef.current = true;
    setIsSigningOut(true);
    setLogoutError(null);

    try {
      await onSignOut();
      navigate("/login", { replace: true });
    } catch (error) {
      setLogoutError(
        getErrorDescriptor(error, message("auth.logoutFailed")),
      );
    } finally {
      isSigningOutRef.current = false;
      setIsSigningOut(false);
    }
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "1rem" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #ddd",
          paddingBottom: "0.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <Link to="/projects" style={{ textDecoration: "none", color: "#333" }}>
          <strong>Slide-First AI Video</strong>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => {
              void handleSignOut();
            }}
            disabled={isSigningOut}
            aria-busy={isSigningOut}
            style={{ cursor: isSigningOut ? "wait" : "pointer" }}
          >
            {isSigningOut ? t("auth.signingOut") : t("auth.logout")}
          </button>
        </div>
      </header>
      {logoutError && (
        <p role="alert" style={{ color: "red" }}>
          {format(logoutError)}
        </p>
      )}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
