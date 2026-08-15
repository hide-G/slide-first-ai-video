import { Authenticator } from "@aws-amplify/ui-react";
import { useNavigate } from "react-router-dom";
import "@aws-amplify/ui-react/styles.css";

export function LoginPage() {
  const navigate = useNavigate();

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
      <Authenticator>
        {({ user }) => {
          if (user) {
            // Redirect to projects page on successful auth
            navigate("/projects", { replace: true });
          }
          return <div>Redirecting...</div>;
        }}
      </Authenticator>
    </div>
  );
}
