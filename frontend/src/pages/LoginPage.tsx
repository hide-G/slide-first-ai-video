import { Authenticator } from "@aws-amplify/ui-react";
import { Navigate } from "react-router-dom";
import "@aws-amplify/ui-react/styles.css";

export function LoginPage() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
      <Authenticator>
        {({ user }) => {
          if (user) {
            return <Navigate to="/projects" replace />;
          }
          return <div>Redirecting...</div>;
        }}
      </Authenticator>
    </div>
  );
}
