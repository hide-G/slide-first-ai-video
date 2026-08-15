import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

export function Layout() {
  const { isAuthenticated, isLoading, username, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "1rem" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #ddd",
          paddingBottom: "1rem",
          marginBottom: "1rem",
        }}
      >
        <nav>
          <Link to="/projects" style={{ marginRight: "1rem" }}>
            Projects
          </Link>
        </nav>
        <div>
          <span style={{ marginRight: "1rem" }}>{username}</span>
          <button onClick={handleSignOut}>Sign Out</button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
