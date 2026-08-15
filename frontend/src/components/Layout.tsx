import { Outlet, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

export function Layout() {
  const { signOut } = useAuth();

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
        <button onClick={signOut} style={{ cursor: "pointer" }}>
          ログアウト
        </button>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
