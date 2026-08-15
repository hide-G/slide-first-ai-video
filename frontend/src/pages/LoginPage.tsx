import { Authenticator } from "@aws-amplify/ui-react";
import { Navigate } from "react-router-dom";
import { LanguageSwitcher } from "../components/LanguageSwitcher.js";
import { useLanguage } from "../i18n/LanguageContext.js";
import "@aws-amplify/ui-react/styles.css";

export function LoginPage() {
  const { t } = useLanguage();

  return (
    <div style={{ maxWidth: "400px", margin: "4rem auto", padding: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <LanguageSwitcher />
      </div>
      <h1 style={{ textAlign: "center", marginBottom: "1rem" }}>
        Slide-First AI Video
      </h1>
      <p style={{ textAlign: "center", color: "#666", marginBottom: "2rem" }}>
        {t("app.tagline")}
      </p>
      <Authenticator>
        {() => <Navigate to="/projects" replace />}
      </Authenticator>
    </div>
  );
}
