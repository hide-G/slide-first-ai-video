import { Authenticator } from "@aws-amplify/ui-react";
import { Navigate } from "react-router-dom";
import "@aws-amplify/ui-react/styles.css";

export function LoginPage() {
  return (
    <div style={{ maxWidth: "400px", margin: "4rem auto", padding: "1rem" }}>
      <h1 style={{ textAlign: "center", marginBottom: "1rem" }}>
        Slide-First AI Video
      </h1>
      <p style={{ textAlign: "center", color: "#666", marginBottom: "2rem" }}>
        スライドから動画を自動生成
      </p>
      <Authenticator>
        {() => <Navigate to="/projects" replace />}
      </Authenticator>
    </div>
  );
}
